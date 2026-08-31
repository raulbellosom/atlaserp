import { useEffect, useState } from 'react'

// CSS percentages can't express "my width = my parent's height", which is
// exactly what a 90/270-rotated image needs: rendered at the parent's
// SWAPPED pixel dimensions (pre-rotation) so that after `transform:
// rotate()` it exactly fills the parent. This measures the parent live
// (ResizeObserver — covers resize-handle drags, crop/rotation changes,
// window resizes) and returns the raw <img>'s pre-rotation pixel size, or
// null before the parent has a measurable size.
export function useRotatedFillSize(ref, rotation) {
  const [size, setSize] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    function recompute() {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const swapped = rotation === 90 || rotation === 270
      setSize(swapped ? { width: rect.height, height: rect.width } : { width: rect.width, height: rect.height })
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, rotation])

  return size
}
