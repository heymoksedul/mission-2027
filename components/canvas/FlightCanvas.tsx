"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 300;
const INITIAL_BURST = 30;

export const FlightCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const currentFrameRef = useRef<number>(1);
  const animationFrameId = useRef<number | null>(null);

  const [isInitialReady, setIsInitialReady] = useState(false);
  const [loadPercent, setLoadPercent] = useState(0);

  const getFrameUrl = useCallback((index: number) => {
    const padded = String(Math.min(TOTAL_FRAMES, Math.max(1, index))).padStart(3, "0");
    return `/bg-frame/ezgif-frame-${padded}.jpg`;
  }, []);

  // Pixel-exact cover rendering onto fixed fullscreen canvas
  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let img = imagesRef.current[frameIndex];

    // Fallback to closest loaded frame if current frame is loading
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < 35; offset++) {
        const prev = imagesRef.current[frameIndex - offset];
        if (prev && prev.complete && prev.naturalWidth > 0) {
          img = prev;
          break;
        }
        const next = imagesRef.current[frameIndex + offset];
        if (next && next.complete && next.naturalWidth > 0) {
          img = next;
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const targetPixelWidth = Math.round(width * dpr);
    const targetPixelHeight = Math.round(height * dpr);

    if (canvas.width !== targetPixelWidth || canvas.height !== targetPixelHeight) {
      canvas.width = targetPixelWidth;
      canvas.height = targetPixelHeight;
    }

    const cWidth = canvas.width;
    const cHeight = canvas.height;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    const hRatio = cWidth / imgW;
    const vRatio = cHeight / imgH;
    const ratio = Math.max(hRatio, vRatio);

    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    const drawX = (cWidth - drawW) / 2;
    const drawY = (cHeight - drawH) / 2;

    ctx.clearRect(0, 0, cWidth, cHeight);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, []);

  const loadSingleImage = useCallback(
    (index: number): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        if (imagesRef.current[index]) {
          resolve(imagesRef.current[index]!);
          return;
        }
        const img = new Image();
        img.src = getFrameUrl(index);
        img.onload = () => {
          imagesRef.current[index] = img;
          resolve(img);
        };
        img.onerror = () => {
          resolve(img);
        };
      });
    },
    [getFrameUrl]
  );

  // Progressive streaming loader
  useEffect(() => {
    imagesRef.current = new Array(TOTAL_FRAMES + 1).fill(null);
    let isCancelled = false;
    let loadedCount = 0;

    const onImageLoaded = () => {
      loadedCount++;
      setLoadPercent(Math.round((loadedCount / TOTAL_FRAMES) * 100));
    };

    // 1. Instantly load frame 1
    loadSingleImage(1).then(() => {
      if (isCancelled) return;
      renderFrame(1);
    });

    // 2. Load initial burst of frames
    const initialPromises: Promise<HTMLImageElement>[] = [];
    for (let i = 1; i <= INITIAL_BURST; i++) {
      initialPromises.push(
        loadSingleImage(i).then((img) => {
          onImageLoaded();
          return img;
        })
      );
    }

    Promise.all(initialPromises).then(() => {
      if (isCancelled) return;
      setIsInitialReady(true);
      renderFrame(1);

      // 3. Stream remaining frames in background
      const streamRest = async () => {
        const batchSize = 15;
        for (let i = INITIAL_BURST + 1; i <= TOTAL_FRAMES; i += batchSize) {
          if (isCancelled) break;
          const batch: Promise<HTMLImageElement>[] = [];
          for (let j = i; j < Math.min(i + batchSize, TOTAL_FRAMES + 1); j++) {
            batch.push(
              loadSingleImage(j).then((img) => {
                onImageLoaded();
                return img;
              })
            );
          }
          await Promise.all(batch);
        }
      };

      streamRest();
    });

    return () => {
      isCancelled = true;
    };
  }, [loadSingleImage, renderFrame]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = requestAnimationFrame(() => {
        renderFrame(currentFrameRef.current);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [renderFrame]);

  // GSAP ScrollTrigger
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const targetFrame = Math.round(1 + self.progress * (TOTAL_FRAMES - 1));
          const clamped = Math.min(TOTAL_FRAMES, Math.max(1, targetFrame));

          if (currentFrameRef.current !== clamped) {
            currentFrameRef.current = clamped;
            renderFrame(clamped);
          }
        },
      });
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [renderFrame]);

  return (
    <>
      {/* Subtle loader until first batch ready */}
      {!isInitialReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <span className="text-xs font-mono text-zinc-400 tracking-widest">
              INITIALIZING {loadPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Permanently Fullscreen Fixed Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-screen h-screen block pointer-events-none z-0"
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* Tall Scroll Track */}
      <div
        ref={containerRef}
        className="relative w-full h-[500vh] pointer-events-none"
      />
    </>
  );
};
