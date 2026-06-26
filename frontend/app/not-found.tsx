"use client";

import Image from "next/image";
import Link from "next/link";

const NotFound = () => {
  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono items-center justify-center p-4">
      <div className="max-w-md w-full border border-border bg-background">
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <span className="text-muted-foreground uppercase tracking-wider text-sm">404</span>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <Image src="/logo1_notext.png" width={64} height={64} alt="Powers Protocol" />
          <p className="text-muted-foreground text-center text-sm">
            Page not found. The address you are looking for does not exist.
          </p>
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:opacity-80 transition-opacity cursor-pointer"
          >
            <span className="text-sm uppercase tracking-wider">Return to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
