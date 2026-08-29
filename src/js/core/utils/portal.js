export function portalDropdown(node, anchorNode) {
    document.body.appendChild(node);
    
    let rafId = null;
    function updatePosition() {
        if (!anchorNode) return;
        
        // Cancel any pending frame to avoid overlapping updates
        if (rafId) cancelAnimationFrame(rafId);
        
        rafId = requestAnimationFrame(() => {
            const rect = anchorNode.getBoundingClientRect();
            node.style.position = 'fixed';
            node.style.top = `${rect.bottom}px`;
            node.style.left = `${rect.left}px`;
            node.style.width = `${rect.width}px`;
            node.style.zIndex = '9999';
            rafId = null;
        });
    }
    
    updatePosition();
    
    // ResizeObserver on the anchor to update width if it changes
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(anchorNode);
    
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    
    return {
        update(newAnchor) {
            anchorNode = newAnchor;
            updatePosition();
        },
        destroy() {
            if (rafId) cancelAnimationFrame(rafId);
            ro.disconnect();
            window.removeEventListener('scroll', updatePosition, { capture: true });
            window.removeEventListener('resize', updatePosition);
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    };
}
