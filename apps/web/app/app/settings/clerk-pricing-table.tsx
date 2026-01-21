"use client";

import { PricingTable } from "@clerk/nextjs";
import { Component, type ReactNode } from "react";

type Props = {
  fallback: ReactNode;
};

type State = {
  hasError: boolean;
};

class PricingTableBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("PricingTable crashed.", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return <PricingTable />;
  }
}

export function ClerkPricingTable({ fallback }: Props) {
  return <PricingTableBoundary fallback={fallback} />;
}
