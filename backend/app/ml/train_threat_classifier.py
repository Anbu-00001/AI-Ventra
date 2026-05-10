"""
AIVENTRA Threat Classifier — Enhanced Training Script
=======================================================
Trains a lightweight CNN on pre-extracted surveillance frames.

Classes mapped to 3 threat levels:
    normal     → NormalVideos
    suspicious → Arrest, Burglary
    critical   → Abuse, Assault, Explosion, Fighting, RoadAccidents, Robbery, Shooting

Outputs (trained_artifacts/):
    threat_classifier.pth       – best model weights
    label_map.json              – class→index mapping
    training_history.json       – loss/acc per epoch
    confusion_matrix.png        – test-set confusion matrix
    training_curves.png         – accuracy & loss curves
    epoch_accuracy.png          – per-epoch bar chart
    classification_report.txt   – precision/recall/F1
    training_summary.json       – full training metadata
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import transforms
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = SCRIPT_DIR / "trained_artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

DATA_ROOT = Path(__file__).resolve().parents[3] / "raw-data" / "archive"
TRAIN_DIR = DATA_ROOT / "Train"
TEST_DIR  = DATA_ROOT / "Test"

# ── Label Mapping ─────────────────────────────────────────────────────────────
THREAT_MAP = {
    "NormalVideos":  "normal",
    "Arrest":        "suspicious",
    "Burglary":      "suspicious",
    "Abuse":         "critical",
    "Assault":       "critical",
    "Explosion":     "critical",
    "Fighting":      "critical",
    "RoadAccidents": "critical",
    "Robbery":       "critical",
    "Shooting":      "critical",
}

LABEL_TO_IDX = {"normal": 0, "suspicious": 1, "critical": 2}
IDX_TO_LABEL = {v: k for k, v in LABEL_TO_IDX.items()}

# ── Hyperparameters ────────────────────────────────────────────────────────────
IMG_SIZE          = 48
BATCH_SIZE        = 256
EPOCHS            = 25
LR                = 3e-4
TRAIN_PER_CLASS   = 4000
TEST_PER_CLASS    = 1500
DEVICE            = "cuda" if torch.cuda.is_available() else "cpu"
NUM_WORKERS       = 2
PATIENCE          = 8


# ── Dataset ────────────────────────────────────────────────────────────────────
class ThreatFrameDataset(Dataset):
    """Loads PNG/JPG frames and maps folder→threat label."""

    def __init__(self, root: Path, transform=None, max_per_class: int | None = None):
        self.transform = transform
        self.samples: list[tuple[str, int]] = []

        buckets: dict[int, list[str]] = {0: [], 1: [], 2: []}
        for folder in sorted(root.iterdir()):
            if not folder.is_dir() or folder.name not in THREAT_MAP:
                continue
            threat = THREAT_MAP[folder.name]
            idx = LABEL_TO_IDX[threat]
            for img_path in folder.iterdir():
                if img_path.suffix.lower() in (".png", ".jpg", ".jpeg"):
                    buckets[idx].append(str(img_path))

        class_counts = {}
        for idx, paths in buckets.items():
            np.random.shuffle(paths)
            cap = max_per_class if max_per_class else len(paths)
            selected = paths[:cap]
            class_counts[IDX_TO_LABEL[idx]] = len(selected)
            for p in selected:
                self.samples.append((p, idx))

        np.random.shuffle(self.samples)
        print(f"  [{root.name}] {len(self.samples)} samples — "
              f"normal={class_counts.get('normal',0)}, "
              f"suspicious={class_counts.get('suspicious',0)}, "
              f"critical={class_counts.get('critical',0)}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, label = self.samples[index]
        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE))
        if self.transform:
            img = self.transform(img)
        return img, label

    def class_weights(self) -> torch.Tensor:
        labels = [s[1] for s in self.samples]
        counts = np.bincount(labels, minlength=3).astype(float)
        counts[counts == 0] = 1
        weights = 1.0 / counts
        return torch.tensor([weights[l] for l in labels], dtype=torch.float)


# ── CNN Architecture ───────────────────────────────────────────────────────────
class ThreatClassifierCNN(nn.Module):
    """
    Compact 4-block CNN for 48×48 inputs → 3 classes.
    ~300K params — fast inference on CPU.
    """

    def __init__(self, num_classes: int = 3):
        super().__init__()
        # Block 1: 48→24
        self.block1 = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(inplace=True),
            nn.MaxPool2d(2), nn.Dropout2d(0.1),
        )
        # Block 2: 24→12
        self.block2 = nn.Sequential(
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(inplace=True),
            nn.MaxPool2d(2), nn.Dropout2d(0.15),
        )
        # Block 3: 12→6
        self.block3 = nn.Sequential(
            nn.Conv2d(64, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(inplace=True),
            nn.MaxPool2d(2), nn.Dropout2d(0.2),
        )
        # Block 4: 6→global
        self.block4 = nn.Sequential(
            nn.Conv2d(128, 128, 3, padding=1), nn.BatchNorm2d(128), nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d(1),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128, 64), nn.ReLU(inplace=True), nn.Dropout(0.4),
            nn.Linear(64, num_classes),
        )

    def forward(self, x):
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        x = self.block4(x)
        return self.classifier(x)


# ── Training Loop ──────────────────────────────────────────────────────────────
def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss, correct, total = 0.0, 0, 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad(set_to_none=True)
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        running_loss += loss.item() * imgs.size(0)
        correct += (outputs.argmax(1) == labels).sum().item()
        total += imgs.size(0)
    return running_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        running_loss += loss.item() * imgs.size(0)
        preds = outputs.argmax(1)
        correct += (preds == labels).sum().item()
        total += imgs.size(0)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())
    return running_loss / total, correct / total, np.array(all_preds), np.array(all_labels)


# ── Visualization ──────────────────────────────────────────────────────────────
def save_training_curves(history: dict, path: Path):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.patch.set_facecolor("#0a0e14")
    for ax in (ax1, ax2):
        ax.set_facecolor("#0a0e14")
        ax.tick_params(colors="#aaa")
        ax.xaxis.label.set_color("#aaa")
        ax.yaxis.label.set_color("#aaa")
        ax.title.set_color("white")
        for spine in ax.spines.values():
            spine.set_color("#333")

    fig.suptitle("AIVENTRA Threat Classifier — Training Curves", fontsize=14,
                 fontweight="bold", color="white")

    epochs = range(1, len(history["train_loss"]) + 1)
    ax1.plot(epochs, history["train_loss"], "o-", color="#ff2848", label="Train Loss", lw=2, ms=4)
    ax1.plot(epochs, history["val_loss"], "s-", color="#18f3e2", label="Val Loss", lw=2, ms=4)
    ax1.set_xlabel("Epoch"); ax1.set_ylabel("Loss"); ax1.set_title("Loss")
    ax1.legend(facecolor="#111", edgecolor="#333", labelcolor="white"); ax1.grid(alpha=0.15)

    ax2.plot(epochs, history["train_acc"], "o-", color="#ff2848", label="Train Acc", lw=2, ms=4)
    ax2.plot(epochs, history["val_acc"], "s-", color="#18f3e2", label="Val Acc", lw=2, ms=4)
    ax2.set_xlabel("Epoch"); ax2.set_ylabel("Accuracy"); ax2.set_title("Accuracy")
    ax2.legend(facecolor="#111", edgecolor="#333", labelcolor="white"); ax2.grid(alpha=0.15)
    ax2.set_ylim(0, 1.05)

    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0a0e14")
    plt.close()
    print(f"  ✓ Training curves → {path.name}")


def save_confusion_matrix(y_true, y_pred, path: Path):
    labels = [IDX_TO_LABEL[i] for i in range(3)]
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(8, 7))
    fig.patch.set_facecolor("#0a0e14")
    ax.set_facecolor("#0a0e14")
    disp = ConfusionMatrixDisplay(cm, display_labels=[l.upper() for l in labels])
    disp.plot(ax=ax, cmap="Reds", values_format="d", colorbar=True)
    ax.set_title("AIVENTRA Threat Classifier — Confusion Matrix",
                 fontsize=13, fontweight="bold", color="white")
    ax.tick_params(colors="#ccc")
    ax.xaxis.label.set_color("#aaa")
    ax.yaxis.label.set_color("#aaa")
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0a0e14")
    plt.close()
    print(f"  ✓ Confusion matrix → {path.name}")


def save_epoch_accuracy_bar(history: dict, path: Path):
    fig, ax = plt.subplots(figsize=(10, 4))
    fig.patch.set_facecolor("#0a0e14")
    ax.set_facecolor("#0a0e14")
    epochs = range(1, len(history["val_acc"]) + 1)
    colors = ["#ff2848" if a < 0.6 else "#f5a400" if a < 0.75 else "#18f3e2" for a in history["val_acc"]]
    ax.bar(epochs, history["val_acc"], color=colors, edgecolor="#222", linewidth=0.8)
    ax.set_xlabel("Epoch", color="#aaa")
    ax.set_ylabel("Validation Accuracy", color="#aaa")
    ax.set_title("Epoch-wise Validation Accuracy", fontsize=13, fontweight="bold", color="white")
    ax.set_ylim(0, 1.05)
    ax.tick_params(colors="#aaa")
    for spine in ax.spines.values():
        spine.set_color("#333")
    ax.grid(axis="y", alpha=0.15)
    best_idx = int(np.argmax(history["val_acc"]))
    ax.annotate(f'{history["val_acc"][best_idx]:.3f}',
                xy=(best_idx + 1, history["val_acc"][best_idx]),
                xytext=(0, 10), textcoords="offset points",
                ha="center", color="#18f3e2", fontweight="bold", fontsize=11)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0a0e14")
    plt.close()
    print(f"  ✓ Epoch accuracy chart → {path.name}")


def save_per_class_accuracy(y_true, y_pred, path: Path):
    """Bar chart showing accuracy per threat level."""
    fig, ax = plt.subplots(figsize=(8, 5))
    fig.patch.set_facecolor("#0a0e14")
    ax.set_facecolor("#0a0e14")
    labels = ["NORMAL", "SUSPICIOUS", "CRITICAL"]
    colors_bar = ["#18f3e2", "#f5a400", "#ff2848"]
    accs = []
    for i in range(3):
        mask = y_true == i
        if mask.sum() > 0:
            accs.append((y_pred[mask] == i).sum() / mask.sum())
        else:
            accs.append(0.0)
    bars = ax.bar(labels, accs, color=colors_bar, edgecolor="#222", width=0.5)
    for bar, acc in zip(bars, accs):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                f"{acc:.1%}", ha="center", color="white", fontweight="bold", fontsize=12)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Accuracy", color="#aaa")
    ax.set_title("Per-Class Accuracy", fontsize=13, fontweight="bold", color="white")
    ax.tick_params(colors="#aaa")
    for spine in ax.spines.values():
        spine.set_color("#333")
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0a0e14")
    plt.close()
    print(f"  ✓ Per-class accuracy → {path.name}")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("=" * 64)
    print("  AIVENTRA Forensic Threat Classifier — Training Pipeline v2")
    print("=" * 64)
    print(f"  Device        : {DEVICE}")
    print(f"  Dataset       : {DATA_ROOT}")
    print(f"  Image size    : {IMG_SIZE}×{IMG_SIZE}")
    print(f"  Train samples : {TRAIN_PER_CLASS} × 3 classes = {TRAIN_PER_CLASS * 3}")
    print(f"  Test samples  : {TEST_PER_CLASS} × 3 classes = {TEST_PER_CLASS * 3}")
    print(f"  Epochs        : {EPOCHS} (patience={PATIENCE})")
    print(f"  Batch size    : {BATCH_SIZE}")
    print(f"  Artifacts     : {ARTIFACTS_DIR}")
    print()

    # Transforms — stronger augmentation for better generalization
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 4, IMG_SIZE + 4)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.15),
        transforms.RandomGrayscale(p=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.15)),
    ])
    test_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # Datasets
    print("▸ Loading datasets...")
    train_ds = ThreatFrameDataset(TRAIN_DIR, transform=train_tf, max_per_class=TRAIN_PER_CLASS)
    test_ds  = ThreatFrameDataset(TEST_DIR,  transform=test_tf,  max_per_class=TEST_PER_CLASS)

    sampler = WeightedRandomSampler(train_ds.class_weights(), len(train_ds), replacement=True)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=NUM_WORKERS, pin_memory=True, drop_last=True)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=True)

    # Model
    model = ThreatClassifierCNN(num_classes=3).to(DEVICE)
    param_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n▸ Model: ThreatClassifierCNN  ({param_count:,} trainable params)")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=LR * 10, epochs=EPOCHS,
        steps_per_epoch=len(train_loader), pct_start=0.2,
    )

    # Training
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "lr": []}
    best_acc = 0.0
    patience_counter = 0
    t0 = time.time()

    print(f"\n{'─'*72}")
    print(f"  {'Epoch':>5} │ {'TrLoss':>7} │ {'TrAcc':>6} │ {'VaLoss':>7} │ {'VaAcc':>6} │ {'LR':>9} │ {'Time':>5}")
    print(f"{'─'*72}")

    for epoch in range(1, EPOCHS + 1):
        epoch_t = time.time()

        # Train
        model.train()
        running_loss, correct, total = 0.0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad(set_to_none=True)
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()
            running_loss += loss.item() * imgs.size(0)
            correct += (outputs.argmax(1) == labels).sum().item()
            total += imgs.size(0)
        train_loss = running_loss / total
        train_acc = correct / total

        # Evaluate
        val_loss, val_acc, _, _ = evaluate(model, test_loader, criterion, DEVICE)

        current_lr = optimizer.param_groups[0]['lr']
        history["train_loss"].append(round(train_loss, 4))
        history["train_acc"].append(round(train_acc, 4))
        history["val_loss"].append(round(val_loss, 4))
        history["val_acc"].append(round(val_acc, 4))
        history["lr"].append(round(current_lr, 8))

        marker = ""
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), ARTIFACTS_DIR / "threat_classifier.pth")
            marker = " ★ BEST"
            patience_counter = 0
        else:
            patience_counter += 1

        elapsed = time.time() - epoch_t
        print(f"  {epoch:5d} │ {train_loss:7.4f} │ {train_acc:5.3f} │ {val_loss:7.4f} │ "
              f"{val_acc:5.3f} │ {current_lr:9.2e} │ {elapsed:4.0f}s{marker}")
        sys.stdout.flush()

        if patience_counter >= PATIENCE:
            print(f"\n  ⚠ Early stopping at epoch {epoch} (no improvement for {PATIENCE} epochs)")
            break

    total_time = time.time() - t0
    print(f"{'─'*72}")
    print(f"\n▸ Training complete in {total_time/60:.1f} min  │  Best val_acc: {best_acc:.4f}")

    # ── Final evaluation ───────────────────────────────────────────────────────
    print("\n▸ Final evaluation with best model...")
    model.load_state_dict(torch.load(ARTIFACTS_DIR / "threat_classifier.pth", weights_only=True))
    _, final_acc, y_pred, y_true = evaluate(model, test_loader, criterion, DEVICE)
    print(f"  Test accuracy: {final_acc:.4f}")

    # ── Save all artifacts ─────────────────────────────────────────────────────
    print("\n▸ Saving artifacts...")

    # 1. Label map
    label_map = {
        "threat_map": THREAT_MAP,
        "label_to_idx": LABEL_TO_IDX,
        "idx_to_label": {str(k): v for k, v in IDX_TO_LABEL.items()},
        "num_classes": 3,
        "img_size": IMG_SIZE,
        "model_arch": "ThreatClassifierCNN",
        "best_val_acc": round(best_acc, 4),
    }
    with open(ARTIFACTS_DIR / "label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
    print(f"  ✓ Label map saved")

    # 2. Training history
    with open(ARTIFACTS_DIR / "training_history.json", "w") as f:
        json.dump(history, f, indent=2)
    print(f"  ✓ Training history saved")

    # 3. Training curves
    save_training_curves(history, ARTIFACTS_DIR / "training_curves.png")

    # 4. Epoch accuracy bar chart
    save_epoch_accuracy_bar(history, ARTIFACTS_DIR / "epoch_accuracy.png")

    # 5. Confusion matrix
    save_confusion_matrix(y_true, y_pred, ARTIFACTS_DIR / "confusion_matrix.png")

    # 6. Per-class accuracy
    save_per_class_accuracy(y_true, y_pred, ARTIFACTS_DIR / "per_class_accuracy.png")

    # 7. Classification report
    report = classification_report(y_true, y_pred,
                                   target_names=["NORMAL", "SUSPICIOUS", "CRITICAL"],
                                   digits=4)
    with open(ARTIFACTS_DIR / "classification_report.txt", "w") as f:
        f.write("AIVENTRA Forensic Threat Classifier — Classification Report\n")
        f.write("=" * 60 + "\n")
        f.write(f"Best Validation Accuracy: {best_acc:.4f}\n")
        f.write(f"Final Test Accuracy: {final_acc:.4f}\n")
        f.write(f"Total Epochs: {len(history['train_loss'])}\n")
        f.write(f"Training Time: {total_time/60:.1f} minutes\n")
        f.write(f"Device: {DEVICE}\n")
        f.write(f"Image Size: {IMG_SIZE}×{IMG_SIZE}\n")
        f.write("=" * 60 + "\n\n")
        f.write(report)
    print(f"  ✓ Classification report saved")
    print(f"\n{report}")

    # 8. Training summary
    summary = {
        "model": "ThreatClassifierCNN",
        "params": param_count,
        "device": DEVICE,
        "img_size": IMG_SIZE,
        "batch_size": BATCH_SIZE,
        "epochs_trained": len(history["train_loss"]),
        "best_val_acc": round(best_acc, 4),
        "final_test_acc": round(final_acc, 4),
        "training_time_min": round(total_time / 60, 1),
        "artifacts": [
            "threat_classifier.pth", "label_map.json", "training_history.json",
            "training_curves.png", "epoch_accuracy.png", "confusion_matrix.png",
            "per_class_accuracy.png", "classification_report.txt",
        ],
    }
    with open(ARTIFACTS_DIR / "training_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("=" * 64)
    print(f"  ✅ All artifacts saved to: {ARTIFACTS_DIR}")
    print(f"  ✅ Best accuracy: {best_acc:.4f}")
    print(f"  ✅ Model ready: threat_classifier.pth")
    print("=" * 64)


if __name__ == "__main__":
    main()
