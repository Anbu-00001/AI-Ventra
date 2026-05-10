#!/usr/bin/env python3
"""
AIVENTRA Forensic Behavioral Anomaly Classifier — Speed-Optimized
==================================================================
Framework  : PyTorch + MobileNetV2 (torchvision, ImageNet weights)
Strategy   : Feature-cache Phase 1 → fine-tune Phase 2
Target     : 75–90% val accuracy within 1 hour on CPU

Speed tricks:
  - Fast file sampling: early-exit scan (never reads all 1M Normal files)
  - No file copying: works directly from archive paths
  - Feature cache: MobileNetV2 base runs ONCE → 4000 × 1280 tensors in RAM
  - Phase 1: train linear head on cached features (15 epochs ≈ 2 min)
  - Phase 2: fine-tune top layers end-to-end (7 epochs ≈ 15 min)
  - 12 CPU threads, batch=32, 160px input

predict_threat(image) → {"class": "Fighting", "confidence": 0.92}
"""

from __future__ import annotations

import itertools
import json
import os
import random
import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
from torch.utils.data import DataLoader, Dataset, TensorDataset
from torchvision import models, transforms
from tqdm import tqdm

# ── Thread optimization ───────────────────────────────────────────────────────
torch.set_num_threads(min(12, os.cpu_count() or 4))
torch.manual_seed(42)
random.seed(42)
np.random.seed(42)

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).resolve().parent
ARCHIVE_ROOT = SCRIPT_DIR / "raw-data" / "archive"
TRAIN_DIR    = ARCHIVE_ROOT / "Train"
TEST_DIR     = ARCHIVE_ROOT / "Test"
MODELS_DIR   = SCRIPT_DIR / "models"
GRAPHS_DIR   = SCRIPT_DIR / "outputs" / "graphs"
CM_DIR       = SCRIPT_DIR / "outputs" / "confusion_matrix"
LOGS_DIR     = SCRIPT_DIR / "outputs" / "logs"

for _d in (MODELS_DIR, GRAPHS_DIR, CM_DIR, LOGS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ── Config ────────────────────────────────────────────────────────────────────
IMAGES_PER_CLASS = 400       # 400 total per class
TRAIN_N          = 320       # 320 train
VAL_N            = 40        # 40 val
TEST_N           = 40        # 40 test
IMG_SIZE         = 160       # faster than 224, still excellent for MobileNetV2
BATCH_SIZE       = 32        # larger batch = better CPU utilization
P1_EPOCHS        = 15        # phase 1: head training on cached features
P2_EPOCHS        = 7         # phase 2: end-to-end fine-tune
P1_LR            = 3e-3      # head training LR
P2_LR            = 5e-5      # fine-tune LR
DEVICE           = "cuda" if torch.cuda.is_available() else "cpu"
NUM_WORKERS      = 4
IMAGE_EXTS       = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

FOLDER_TO_LABEL: dict[str, str] = {
    "Abuse":         "Abuse",
    "Arrest":        "Arrest",
    "Assault":       "Assault",
    "Burglary":      "Burglary",
    "Explosion":     "Explosion",
    "Fighting":      "Fighting",
    "NormalVideos":  "Normal",
    "RoadAccidents": "RoadAccident",
    "Robbery":       "Robbery",
    "Shooting":      "Shooting",
}
CLASSES      = sorted(FOLDER_TO_LABEL.values())
NUM_CLASSES  = len(CLASSES)
LABEL_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_LABEL = {i: c for i, c in enumerate(CLASSES)}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Fast Sampling (early-exit: never scans all 1M Normal files)
# ═══════════════════════════════════════════════════════════════════════════════

def fast_sample(dirs: list[Path], n: int) -> list[Path]:
    """
    Return up to n image paths from dirs — stops as soon as n found.
    For NormalVideos (947K files) we stop after scanning ~400, not 947K.
    """
    found: list[Path] = []
    for d in dirs:
        if not d.is_dir():
            continue
        remaining = n - len(found)
        if remaining <= 0:
            break
        for entry in itertools.islice(d.iterdir(), remaining * 3):
            if entry.is_file() and entry.suffix.lower() in IMAGE_EXTS:
                found.append(entry)
                if len(found) >= n:
                    return found
    return found


def build_sample_lists() -> tuple[list, list, list]:
    """
    For each class: fast-sample 400 paths → shuffle → split 320/40/40.
    Returns (train_samples, val_samples, test_samples) — list of (path_str, label_idx).
    """
    print("\n" + "═" * 66)
    print("  STEP 1 — Fast Sampling  (400/class, 320 train / 40 val / 40 test)")
    print(f"  {'Class':14s}  {'Found':>6}  {'Train':>6}  {'Val':>6}  {'Test':>6}")
    print("  " + "─" * 52)

    train_s, val_s, test_s = [], [], []

    for folder, label in sorted(FOLDER_TO_LABEL.items(), key=lambda x: x[1]):
        t0 = time.time()
        paths = fast_sample([TRAIN_DIR / folder, TEST_DIR / folder], IMAGES_PER_CLASS)
        random.shuffle(paths)

        tr = paths[:TRAIN_N]
        va = paths[TRAIN_N: TRAIN_N + VAL_N]
        te = paths[TRAIN_N + VAL_N: TRAIN_N + VAL_N + TEST_N]

        idx = LABEL_TO_IDX[label]
        train_s.extend([(str(p), idx) for p in tr])
        val_s.extend([(str(p), idx) for p in va])
        test_s.extend([(str(p), idx) for p in te])

        print(f"  {label:14s}  {len(paths):>6}  {len(tr):>6}  {len(va):>6}  {len(te):>6}"
              f"  ({time.time()-t0:.1f}s)")

    random.shuffle(train_s)
    print(f"\n  Totals: train={len(train_s)}, val={len(val_s)}, test={len(test_s)}")
    return train_s, val_s, test_s


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Dataset + Transforms
# ═══════════════════════════════════════════════════════════════════════════════

_MEAN = [0.485, 0.456, 0.406]
_STD  = [0.229, 0.224, 0.225]

TRAIN_TF = transforms.Compose([
    transforms.Resize((IMG_SIZE + 20, IMG_SIZE + 20)),
    transforms.RandomCrop(IMG_SIZE),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=15),
    transforms.ColorJitter(brightness=0.3, contrast=0.25, saturation=0.2, hue=0.05),
    transforms.RandomGrayscale(p=0.05),
    transforms.ToTensor(),
    transforms.Normalize(_MEAN, _STD),
    transforms.RandomErasing(p=0.1, scale=(0.02, 0.1)),
])

EVAL_TF = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(_MEAN, _STD),
])


class ForensicDataset(Dataset):
    def __init__(self, samples: list[tuple[str, int]], transform):
        self.samples   = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), color=128)
        return self.transform(img), label


def make_loaders(
    train_s: list, val_s: list, test_s: list
) -> tuple[DataLoader, DataLoader, DataLoader]:
    kw = dict(num_workers=NUM_WORKERS, pin_memory=(DEVICE == "cuda"), persistent_workers=True)
    return (
        DataLoader(ForensicDataset(train_s, TRAIN_TF), batch_size=BATCH_SIZE, shuffle=True,  drop_last=True,  **kw),
        DataLoader(ForensicDataset(val_s,   EVAL_TF),  batch_size=BATCH_SIZE, shuffle=False, **kw),
        DataLoader(ForensicDataset(test_s,  EVAL_TF),  batch_size=BATCH_SIZE, shuffle=False, **kw),
    )

def make_eval_loader(samples: list) -> DataLoader:
    kw = dict(num_workers=NUM_WORKERS, pin_memory=(DEVICE == "cuda"), persistent_workers=True)
    return DataLoader(ForensicDataset(samples, EVAL_TF), batch_size=BATCH_SIZE, shuffle=False, **kw)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — MobileNetV2 Setup
# ═══════════════════════════════════════════════════════════════════════════════

def build_model() -> tuple[nn.Module, nn.Module]:
    """Returns (full_model, base_only) — base_only is MobileNetV2.features + pool."""
    weights = models.MobileNet_V2_Weights.IMAGENET1K_V1
    net = models.mobilenet_v2(weights=weights)

    # Freeze everything
    for p in net.parameters():
        p.requires_grad = False

    # Replace classifier head
    net.classifier = nn.Sequential(
        nn.Dropout(p=0.4),
        nn.Linear(1280, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.35),
        nn.Linear(512, NUM_CLASSES),
    )
    # Enable head grad
    for p in net.classifier.parameters():
        p.requires_grad = True

    return net.to(DEVICE)


def unfreeze_top_layers(net: nn.Module, n: int = 30) -> int:
    """Unfreeze last n layers of features. Returns trainable param count."""
    layers = list(net.features.parameters())
    for p in layers[-n:]:
        p.requires_grad = True
    return sum(p.numel() for p in net.parameters() if p.requires_grad)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Feature Caching (run MobileNetV2 base ONCE over all images)
# ═══════════════════════════════════════════════════════════════════════════════

@torch.no_grad()
def cache_features(net: nn.Module, loader: DataLoader, desc: str) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Pass all images through the frozen MobileNetV2 base.
    Returns (features [N×1280], labels [N]).
    Called once — eliminates repeated backbone computation during head training.
    """
    net.eval()
    feats, lbls = [], []
    bar = tqdm(loader, desc=f"  {desc}", ncols=80)
    for imgs, labels in bar:
        imgs = imgs.to(DEVICE)
        x = net.features(imgs)
        x = F.adaptive_avg_pool2d(x, 1).flatten(1)
        feats.append(x.cpu())
        lbls.append(labels)
    return torch.cat(feats), torch.cat(lbls)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Training Loops
# ═══════════════════════════════════════════════════════════════════════════════

def train_head_on_cache(
    net: nn.Module,
    feat_train: torch.Tensor, lbl_train: torch.Tensor,
    feat_val:   torch.Tensor, lbl_val:   torch.Tensor,
    epochs: int, lr: float,
    history: dict,
    best_ckpt: Path,
) -> float:
    """
    Phase 1: train only the classifier head using cached feature vectors.
    Extremely fast — no backbone forward pass needed.
    """
    print(f"\n  ── Phase 1: Head Training on Cached Features ({epochs} epochs) ──")
    print(f"  {'Epoch':>5}  {'TrLoss':>7}  {'TrAcc':>6}  {'VaLoss':>7}  {'VaAcc':>6}  {'Best':>5}")
    print("  " + "─" * 52)

    train_ds = TensorDataset(feat_train, lbl_train)
    val_ds   = TensorDataset(feat_val,   lbl_val)
    kw = dict(batch_size=64, num_workers=0)
    tr_loader = DataLoader(train_ds, shuffle=True,  **kw)
    va_loader = DataLoader(val_ds,   shuffle=False, **kw)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    optimizer = optim.Adam(net.classifier.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_acc = 0.0
    for epoch in range(1, epochs + 1):
        # Train
        net.train()
        tr_loss = tr_correct = tr_total = 0
        for feat, labels in tr_loader:
            feat, labels = feat.to(DEVICE), labels.to(DEVICE)
            # Inject noise for implicit augmentation on cached features
            feat = feat + 0.02 * torch.randn_like(feat)
            optimizer.zero_grad(set_to_none=True)
            logits = net.classifier(feat)
            loss = criterion(logits, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(net.classifier.parameters(), 2.0)
            optimizer.step()
            tr_loss    += loss.item() * feat.size(0)
            tr_correct += (logits.argmax(1) == labels).sum().item()
            tr_total   += feat.size(0)

        # Val
        net.eval()
        va_loss = va_correct = va_total = 0
        with torch.no_grad():
            for feat, labels in va_loader:
                feat, labels = feat.to(DEVICE), labels.to(DEVICE)
                logits = net.classifier(feat)
                loss = criterion(logits, labels)
                va_loss    += loss.item() * feat.size(0)
                va_correct += (logits.argmax(1) == labels).sum().item()
                va_total   += feat.size(0)

        scheduler.step()
        tr_loss /= tr_total; tr_acc = tr_correct / tr_total
        va_loss /= va_total; va_acc = va_correct / va_total

        history["train_loss"].append(round(tr_loss, 4))
        history["train_acc"].append(round(tr_acc,   4))
        history["val_loss"].append(round(va_loss,   4))
        history["val_acc"].append(round(va_acc,     4))
        history["phase"].append(1)

        marker = ""
        if va_acc > best_acc:
            best_acc = va_acc
            torch.save(net.state_dict(), best_ckpt)
            marker = " ★"

        print(f"  {epoch:5d}  {tr_loss:7.4f}  {tr_acc:5.3f}  "
              f"{va_loss:7.4f}  {va_acc:5.3f}  {best_acc:5.3f}{marker}")
        sys.stdout.flush()

    return best_acc


def train_e2e(
    net: nn.Module,
    train_loader: DataLoader, val_loader: DataLoader,
    epochs: int, lr: float,
    history: dict,
    best_ckpt: Path,
    best_so_far: float,
) -> float:
    """
    Phase 2: end-to-end fine-tuning with augmented images.
    Top layers of MobileNetV2 unfrozen + head trained together.
    """
    n_params = unfreeze_top_layers(net, n=30)
    print(f"\n  ── Phase 2: End-to-End Fine-Tuning ({epochs} epochs, {n_params:,} params) ──")
    print(f"  {'Epoch':>5}  {'TrLoss':>7}  {'TrAcc':>6}  {'VaLoss':>7}  {'VaAcc':>6}  {'Best':>5}")
    print("  " + "─" * 52)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)
    optimizer = optim.Adam(
        filter(lambda p: p.requires_grad, net.parameters()),
        lr=lr, weight_decay=5e-4,
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-7)

    best_acc = best_so_far
    for epoch in range(1, epochs + 1):
        t0 = time.time()

        # Train
        net.train()
        tr_loss = tr_correct = tr_total = 0
        bar = tqdm(train_loader, desc=f"  e{epoch:02d} train", leave=False, ncols=80)
        for imgs, labels in bar:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad(set_to_none=True)
            logits = net(imgs)
            loss   = criterion(logits, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(net.parameters(), 2.0)
            optimizer.step()
            tr_loss    += loss.item() * imgs.size(0)
            tr_correct += (logits.argmax(1) == labels).sum().item()
            tr_total   += imgs.size(0)
            bar.set_postfix(loss=f"{loss.item():.3f}")

        # Val
        net.eval()
        va_loss = va_correct = va_total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                logits = net(imgs)
                loss   = criterion(logits, labels)
                va_loss    += loss.item() * imgs.size(0)
                va_correct += (logits.argmax(1) == labels).sum().item()
                va_total   += imgs.size(0)

        scheduler.step()
        tr_loss /= tr_total; tr_acc = tr_correct / tr_total
        va_loss /= va_total; va_acc = va_correct / va_total
        elapsed = time.time() - t0

        history["train_loss"].append(round(tr_loss, 4))
        history["train_acc"].append(round(tr_acc,   4))
        history["val_loss"].append(round(va_loss,   4))
        history["val_acc"].append(round(va_acc,     4))
        history["phase"].append(2)

        marker = ""
        if va_acc > best_acc:
            best_acc = va_acc
            torch.save(net.state_dict(), best_ckpt)
            marker = " ★"

        print(f"  {epoch:5d}  {tr_loss:7.4f}  {tr_acc:5.3f}  "
              f"{va_loss:7.4f}  {va_acc:5.3f}  {best_acc:5.3f}  {elapsed:.0f}s{marker}")
        sys.stdout.flush()

    return best_acc


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Evaluation + Plots
# ═══════════════════════════════════════════════════════════════════════════════

@torch.no_grad()
def full_eval(
    net: nn.Module, loader: DataLoader, criterion: nn.Module
) -> tuple[float, float, np.ndarray, np.ndarray]:
    net.eval()
    all_preds, all_labels = [], []
    total_loss = n = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
        logits = net(imgs)
        total_loss += criterion(logits, labels).item() * imgs.size(0)
        all_preds.extend(logits.argmax(1).cpu().numpy())
        all_labels.extend(labels.cpu().numpy())
        n += imgs.size(0)
    y_pred = np.array(all_preds)
    y_true = np.array(all_labels)
    return total_loss / n, (y_pred == y_true).mean(), y_pred, y_true


_BG = "#0a0e14"

def _style(ax):
    ax.set_facecolor(_BG); ax.tick_params(colors="#aaa")
    ax.xaxis.label.set_color("#aaa"); ax.yaxis.label.set_color("#aaa")
    ax.title.set_color("white")
    for s in ax.spines.values(): s.set_color("#333")


def save_training_curves(history: dict, path: Path) -> None:
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.patch.set_facecolor(_BG)
    for ax in (ax1, ax2): _style(ax)
    fig.suptitle("AIVENTRA Anomaly Classifier — Training", fontsize=14, fontweight="bold", color="white")

    ep = range(1, len(history["train_loss"]) + 1)
    # Draw phase separator
    p2_start = sum(1 for p in history["phase"] if p == 1)

    for ax, key, title in [(ax1, "loss", "Loss"), (ax2, "acc", "Accuracy")]:
        ax.plot(ep, history[f"train_{key}"], "o-", color="#ff2848", label="Train", lw=2, ms=3)
        ax.plot(ep, history[f"val_{key}"],   "s-", color="#18f3e2", label="Val",   lw=2, ms=3)
        if p2_start < len(list(ep)):
            ax.axvline(p2_start + 0.5, color="#f5a400", lw=1.5, ls="--", alpha=0.7, label="Fine-tune")
        ax.set_xlabel("Epoch"); ax.set_ylabel(title.capitalize()); ax.set_title(title)
        ax.legend(facecolor="#111", edgecolor="#333", labelcolor="white")
        ax.grid(alpha=0.15)

    ax2.set_ylim(0, 1.05)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=_BG)
    plt.close()
    print(f"  ✓ Training curves     → outputs/graphs/training_curves.png")


def save_epoch_acc_bar(history: dict, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(14, 4))
    fig.patch.set_facecolor(_BG); _style(ax)
    va = history["val_acc"]
    ep = range(1, len(va) + 1)
    clrs = ["#ff2848" if a < 0.55 else "#f5a400" if a < 0.72 else "#18f3e2" for a in va]
    ax.bar(ep, va, color=clrs, edgecolor="#222", width=0.7)
    best_i = int(np.argmax(va))
    ax.annotate(f"{va[best_i]:.3f}", xy=(best_i + 1, va[best_i]),
                xytext=(0, 8), textcoords="offset points",
                ha="center", color="#18f3e2", fontweight="bold", fontsize=11)
    ax.set_ylim(0, 1.1)
    ax.set_xlabel("Epoch", color="#aaa"); ax.set_ylabel("Val Accuracy", color="#aaa")
    ax.set_title("Epoch-wise Validation Accuracy", fontsize=13, fontweight="bold", color="white")
    ax.grid(axis="y", alpha=0.15)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=_BG)
    plt.close()
    print(f"  ✓ Epoch accuracy bar  → outputs/graphs/epoch_accuracy.png")


def save_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, path: Path) -> None:
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(11, 9))
    fig.patch.set_facecolor(_BG); ax.set_facecolor(_BG)
    ConfusionMatrixDisplay(cm, display_labels=[c.upper() for c in CLASSES]).plot(
        ax=ax, cmap="Blues", values_format="d", colorbar=True)
    ax.set_title("AIVENTRA — Confusion Matrix", fontsize=13, fontweight="bold", color="white")
    ax.tick_params(colors="#ccc"); ax.xaxis.label.set_color("#aaa"); ax.yaxis.label.set_color("#aaa")
    plt.xticks(rotation=40, ha="right", fontsize=8)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=_BG)
    plt.close()
    print(f"  ✓ Confusion matrix    → outputs/confusion_matrix/confusion_matrix.png")


def save_per_class_acc(y_true: np.ndarray, y_pred: np.ndarray, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(12, 5))
    fig.patch.set_facecolor(_BG); _style(ax)
    accs = []
    for i in range(NUM_CLASSES):
        mask = y_true == i
        accs.append(float((y_pred[mask] == i).sum() / max(mask.sum(), 1)))
    palette = ["#18f3e2","#00d4ff","#f5a400","#ff9500","#ff2848",
               "#e91e63","#9c27b0","#3f51b5","#4caf50","#8bc34a"]
    bars = ax.bar(CLASSES, accs, color=palette[:NUM_CLASSES], edgecolor="#222", width=0.65)
    for bar, acc in zip(bars, accs):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.025,
                f"{acc:.0%}", ha="center", color="white", fontweight="bold", fontsize=9)
    ax.set_ylim(0, 1.2)
    ax.set_ylabel("Accuracy", color="#aaa")
    ax.set_title("Per-Class Accuracy", fontsize=13, fontweight="bold", color="white")
    plt.xticks(rotation=30, ha="right", fontsize=9)
    ax.grid(axis="y", alpha=0.15)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor=_BG)
    plt.close()
    print(f"  ✓ Per-class accuracy  → outputs/graphs/per_class_accuracy.png")


# ═══════════════════════════════════════════════════════════════════════════════
# Inference API
# ═══════════════════════════════════════════════════════════════════════════════

def predict_threat(
    image,
    model_path: str | Path = MODELS_DIR / "anomaly_classifier.pth",
    label_path: str | Path = MODELS_DIR / "label_encoder.json",
) -> dict:
    """
    Classify a forensic activity image.

    Args:
        image: file path (str/Path), PIL.Image, or numpy uint8 array (H×W×3)

    Returns:
        {"class": "Fighting", "confidence": 0.92, "all_scores": {...}}
    """
    with open(label_path) as f:
        meta = json.load(f)
    classes = meta["classes"]

    net = build_model()
    net.load_state_dict(torch.load(model_path, map_location=DEVICE, weights_only=True))
    net.eval()

    if isinstance(image, (str, Path)):
        img = Image.open(image).convert("RGB")
    elif isinstance(image, np.ndarray):
        img = Image.fromarray(image.astype(np.uint8))
    else:
        img = image.convert("RGB")

    tensor = EVAL_TF(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        probs = torch.softmax(net(tensor), dim=1).squeeze().cpu().numpy()

    top = int(probs.argmax())
    return {
        "class":      classes[top],
        "confidence": round(float(probs[top]), 4),
        "all_scores": {classes[i]: round(float(p), 4) for i, p in enumerate(probs)},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    t_global = time.time()

    print("=" * 66)
    print("  AIVENTRA Forensic Behavioral Anomaly Classifier")
    print("  MobileNetV2 | Feature-Cache + Fine-Tune | Speed-Optimized")
    print("=" * 66)
    print(f"  Device       : {DEVICE}  ({torch.get_num_threads()} threads)")
    print(f"  Classes      : {NUM_CLASSES}  →  {CLASSES}")
    print(f"  Images/class : {IMAGES_PER_CLASS}  (320 train / 40 val / 40 test)")
    print(f"  Image size   : {IMG_SIZE}×{IMG_SIZE}")
    print(f"  Batch size   : {BATCH_SIZE}")
    print(f"  Phase 1      : {P1_EPOCHS} epochs head-only (cached features)")
    print(f"  Phase 2      : {P2_EPOCHS} epochs end-to-end fine-tune")
    print()

    # Step 1: Fast sample
    train_s, val_s, test_s = build_sample_lists()

    # Step 2: DataLoaders
    train_loader, val_loader, test_loader = make_loaders(train_s, val_s, test_s)
    # Eval loaders use EVAL_TF (no augmentation) for feature caching
    train_eval_loader = make_eval_loader(train_s)

    # Step 3: Build model
    print("\n" + "═" * 66)
    print("  STEP 2 — Feature Extraction (MobileNetV2 base, frozen)")
    print("═" * 66)
    net = build_model()
    n_head = sum(p.numel() for p in net.parameters() if p.requires_grad)
    print(f"\n  MobileNetV2 ready — {n_head:,} head params")

    # Step 4: Cache features (runs backbone ONCE — avoids repeated backbone compute)
    print()
    feat_train, lbl_train = cache_features(net, train_eval_loader, "Cache train features")
    feat_val,   lbl_val   = cache_features(net, val_loader,        "Cache val features  ")
    print(f"\n  Feature shape: {feat_train.shape}  (dtype={feat_train.dtype})")

    # Step 5: Phase 1 — train head on cached features
    history: dict = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": [], "phase": []}
    best_ckpt = MODELS_DIR / "anomaly_classifier_best.pth"

    best_acc = train_head_on_cache(
        net, feat_train, lbl_train, feat_val, lbl_val,
        epochs=P1_EPOCHS, lr=P1_LR,
        history=history, best_ckpt=best_ckpt,
    )
    print(f"\n  Phase 1 best val_acc: {best_acc:.4f}")

    # Step 6: Phase 2 — fine-tune end-to-end with augmented images
    net.load_state_dict(torch.load(best_ckpt, map_location=DEVICE, weights_only=True))
    best_acc = train_e2e(
        net, train_loader, val_loader,
        epochs=P2_EPOCHS, lr=P2_LR,
        history=history, best_ckpt=best_ckpt, best_so_far=best_acc,
    )
    print(f"\n  Phase 2 best val_acc: {best_acc:.4f}")

    # Step 7: Final evaluation
    print("\n" + "═" * 66)
    print("  STEP 7 — Final Test Evaluation")
    print("═" * 66)
    net.load_state_dict(torch.load(best_ckpt, map_location=DEVICE, weights_only=True))
    criterion = nn.CrossEntropyLoss()
    te_loss, te_acc, y_pred, y_true = full_eval(net, test_loader, criterion)
    report = classification_report(y_true, y_pred, target_names=CLASSES, digits=4)
    print(f"\n  Test accuracy : {te_acc:.4f}")
    print(f"  Test loss     : {te_loss:.4f}")
    print(f"\n{report}")

    # Step 8: Save artifacts
    print("\n" + "═" * 66)
    print("  STEP 8 — Saving Artifacts")
    print("═" * 66 + "\n")

    # Model
    final_path = MODELS_DIR / "anomaly_classifier.pth"
    torch.save(net.state_dict(), final_path)
    print(f"  ✓ Model               → models/anomaly_classifier.pth")

    # Label encoder
    with open(MODELS_DIR / "label_encoder.json", "w") as f:
        json.dump({
            "classes":      CLASSES,
            "label_to_idx": LABEL_TO_IDX,
            "idx_to_label": {str(k): v for k, v in IDX_TO_LABEL.items()},
            "num_classes":  NUM_CLASSES,
            "img_size":     IMG_SIZE,
            "model_arch":   "MobileNetV2",
            "best_val_acc": round(best_acc, 4),
            "test_acc":     round(te_acc, 4),
        }, f, indent=2)
    print(f"  ✓ Label encoder       → models/label_encoder.json")

    # History + summary
    with open(LOGS_DIR / "training_history.json", "w") as f:
        json.dump(history, f, indent=2)
    total_min = (time.time() - t_global) / 60
    with open(LOGS_DIR / "training_summary.json", "w") as f:
        json.dump({
            "model": "MobileNetV2", "framework": "PyTorch",
            "device": DEVICE, "num_classes": NUM_CLASSES,
            "classes": CLASSES, "images_per_class": IMAGES_PER_CLASS,
            "img_size": IMG_SIZE, "batch_size": BATCH_SIZE,
            "phase1_epochs": P1_EPOCHS, "phase2_epochs": P2_EPOCHS,
            "best_val_acc": round(best_acc, 4), "test_acc": round(te_acc, 4),
            "training_min": round(total_min, 1),
        }, f, indent=2)
    print(f"  ✓ Logs                → outputs/logs/")

    # Classification report
    with open(LOGS_DIR / "classification_report.txt", "w") as f:
        f.write(f"AIVENTRA Forensic Behavioral Anomaly Classifier\n{'='*60}\n")
        f.write(f"Model: MobileNetV2 | Framework: PyTorch\n")
        f.write(f"Best val acc: {best_acc:.4f} | Test acc: {te_acc:.4f}\n")
        f.write(f"Training time: {total_min:.1f} min\n{'='*60}\n\n")
        f.write(report)

    # Plots
    save_training_curves(history, GRAPHS_DIR / "training_curves.png")
    save_epoch_acc_bar(history,   GRAPHS_DIR / "epoch_accuracy.png")
    save_confusion_matrix(y_true, y_pred, CM_DIR / "confusion_matrix.png")
    save_per_class_acc(y_true, y_pred,    GRAPHS_DIR / "per_class_accuracy.png")

    print(f"\n{'='*66}")
    print(f"  ✅  Best validation accuracy : {best_acc:.4f}")
    print(f"  ✅  Final test accuracy      : {te_acc:.4f}")
    print(f"  ✅  Training time            : {total_min:.1f} minutes")
    print(f"  ✅  Model                    : models/anomaly_classifier.pth")
    print(f"{'='*66}")

    # Quick inference demo
    demo = next((Path(p) for p, _ in test_s if Path(p).exists()), None)
    if demo:
        result = predict_threat(demo, model_path=final_path, label_path=MODELS_DIR/"label_encoder.json")
        print(f"\n  Demo → predict_threat('{demo.name}')")
        print(f"       → {result}")


if __name__ == "__main__":
    main()
