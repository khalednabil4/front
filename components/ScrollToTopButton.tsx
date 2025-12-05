import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';

const THRESHOLD = 200;

function findScrollableAncestor(el?: Element | null): Element | Window {
    if (!el) return window;
    let cur: Element | null = el as Element;
    while (cur && cur !== document.documentElement) {
        try {
            const style = getComputedStyle(cur);
            const overflowY = style.overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && cur.scrollHeight > cur.clientHeight) {
                return cur;
            }
        } catch (e) {
            // ignore cross-origin issues
        }
        cur = cur.parentElement;
    }
    return window;
}

const ScrollToTopButton: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const lastScrolledRef = useRef<Element | Window | null>(null);

    useEffect(() => {
        const onScroll = (e: Event) => {
            const target = e.target as Element | Document | null;
            const scroller = target && target instanceof Element ? findScrollableAncestor(target) : window;
            lastScrolledRef.current = scroller;

            let scrollTop = 0;
            if (scroller === window) scrollTop = window.scrollY || window.pageYOffset || 0;
            else scrollTop = (scroller as Element).scrollTop;

            setVisible(scrollTop > THRESHOLD);
        };

        // Capture scrolls from any element by listening on document with capture
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            document.removeEventListener('scroll', onScroll, { capture: true, passive: true } as any);
            window.removeEventListener('scroll', onScroll as any);
        };
    }, []);

    const handleClick = () => {
        const scroller = lastScrolledRef.current || window;
        if (scroller === window) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            try {
                (scroller as Element).scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };

    if (!visible) return null;

    return (
        <button
            onClick={handleClick}
            className="fixed bottom-6 right-6 z-[999] bg-water-600 hover:bg-water-700 text-white rounded-full shadow-lg p-3 flex items-center justify-center transition-all duration-200 scroll-top-wrapper"
            aria-label="Scroll to top"
            style={{ boxShadow: '0 2px 12px rgba(14,165,233,0.18)' }}
        >
            {/* pulse ring */}
            <span className="pulse-ring" aria-hidden="true"></span>

            {/* icon with gentle bob */}
            <span className="relative upscroll-bob">
                <ChevronUp size={28} />
            </span>
        </button>
    );
};

export default ScrollToTopButton;

