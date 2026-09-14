"use client";

import React from "react";
import { FlightCanvas } from "@/components/canvas/FlightCanvas";

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-black">
      {/* Pure 3D Frame Scroll Animation with Native Instant Scroll */}
      <FlightCanvas />
    </main>
  );
}
