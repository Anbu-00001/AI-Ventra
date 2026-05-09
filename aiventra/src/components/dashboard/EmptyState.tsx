import React from "react";
import { ShieldAlert, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

export function EmptyState({ message = "No forensic evidence detected for this case." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-black/40 backdrop-blur-sm border border-white/5 rounded-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 bg-crimson/20 rounded-full blur-2xl animate-pulse" />
        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-crimson/50 bg-black/50 shadow-[0_0_30px_rgba(255,40,72,0.2)]">
          <ShieldAlert size={48} className="text-crimson-glow" />
        </div>
      </motion.div>
      <h3 className="font-orbitron text-xl font-bold tracking-widest text-white mb-2 uppercase">
        Intelligence Gap Detected
      </h3>
      <p className="font-mono text-sm text-slate-400 max-w-md mb-8">
        {message} Please upload digital forensic artifacts (Autopsy, GPS, CCTV, or Call Logs) to initiate neural correlation.
      </p>
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2 border border-white/10 bg-white/5 rounded font-mono text-[10px] text-slate-500 uppercase tracking-tighter">
          <UploadCloud size={14} /> Waiting for Ingestion
        </div>
      </div>
    </div>
  );
}
