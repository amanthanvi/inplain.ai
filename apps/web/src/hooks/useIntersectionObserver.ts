"use client";

import { useEffect, useRef, useState } from "react";

interface UseIntersectionObserverOptions {
	threshold?: number;
	rootMargin?: string;
	once?: boolean;
}

export function useIntersectionObserver({
	threshold = 0.1,
	rootMargin = "0px",
	once = true,
}: UseIntersectionObserverOptions = {}) {
	const [isIntersecting, setIsIntersecting] = useState(false);
	const ref = useRef<HTMLElement>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry) {
					return;
				}

				setIsIntersecting(entry.isIntersecting);

				if (once && entry.isIntersecting) {
					observer.unobserve(element);
				}
			},
			{
				threshold,
				rootMargin,
			}
		);

		observer.observe(element);

		return () => {
			if (element) {
				observer.unobserve(element);
			}
		};
	}, [threshold, rootMargin, once]);

	return { ref, isIntersecting };
}
