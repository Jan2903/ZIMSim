export function portalDropdown(node, anchorNode) {
    document.body.appendChild(node);
    
    function updatePosition() {
        if (!anchorNode) return;
        const rect = anchorNode.getBoundingClientRect();
        node.style.position = 'fixed';
        node.style.top = `${rect.bottom}px`;
        node.style.left = `${rect.left}px`;
        node.style.width = `${rect.width}px`;
        node.style.zIndex = '9999';
    }
    
    updatePosition();
    
    // ResizeObserver on the anchor to update width if it changes
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(anchorNode);
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return {
        update(newAnchor) {
            anchorNode = newAnchor;
            updatePosition();
        },
        destroy() {
            ro.disconnect();
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            if (node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }
    };
}
