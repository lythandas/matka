"use client";

import React, { useEffect, useRef } from 'react';
import anime from 'animejs'; // Changed import to directly import the default export

const IsometricVan: React.FC = () => {
  const vanRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<anime.AnimeInstance | null>(null);
  const bounceAnimationRef = useRef<anime.AnimeInstance | null>(null);

  useEffect(() => {
    if (!vanRef.current) return;

    // Initial position off-screen left
    anime.set(vanRef.current, { // Now 'anime' should be the function, so .set should work
      translateX: '-100%', // Start completely off-screen left
      translateY: '0px',
      rotate: '0deg',
    });

    // Main driving animation
    animationRef.current = anime({ // Now 'anime' should be the function
      targets: vanRef.current,
      translateX: ['-100%', '110vw'], // Drive across the screen and off to the right
      duration: 10000, // 10 seconds for one trip
      easing: 'linear',
      loop: true,
    });

    // Subtle bounce and rotation for realism
    bounceAnimationRef.current = anime({ // Now 'anime' should be the function
      targets: vanRef.current,
      translateY: [
        { value: -5, duration: 500, easing: 'easeInOutSine' },
        { value: 0, duration: 500, easing: 'easeInOutSine' },
      ],
      rotate: [
        { value: 0.5, duration: 500, easing: 'easeInOutSine' },
        { value: -0.5, duration: 500, easing: 'easeInOutSine' },
        { value: 0, duration: 500, easing: 'easeInOutSine' },
      ],
      loop: true,
      direction: 'alternate',
      duration: 1500, // Shorter duration for bounce cycle
      easing: 'easeInOutSine',
    });

    return () => {
      animationRef.current?.pause();
      bounceAnimationRef.current?.pause();
    };
  }, []);

  return (
    <div ref={vanRef} className="absolute bottom-0 left-0 z-0">
      {/* Simple Isometric Van SVG */}
      <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <path d="M10 30 L40 10 L110 10 L80 30 L10 30 Z" fill="#FFD700" stroke="#333" strokeWidth="1"/> {/* Top */}
        <path d="M10 30 L10 80 L80 80 L80 30 L10 30 Z" fill="#FFD700" stroke="#333" strokeWidth="1"/> {/* Left Side */}
        <path d="M80 30 L110 10 L110 60 L80 80 L80 30 Z" fill="#FFD700" stroke="#333" strokeWidth="1"/> {/* Right Side */}

        {/* Window */}
        <path d="M45 15 L95 15 L75 30 L25 30 L45 15 Z" fill="#ADD8E6" stroke="#333" strokeWidth="0.5"/>

        {/* Wheels */}
        <circle cx="30" cy="80" r="10" fill="#333" stroke="#000" strokeWidth="1"/>
        <circle cx="90" cy="80" r="10" fill="#333" stroke="#000" strokeWidth="1"/>
      </svg>
    </div>
  );
};

export default IsometricVan;