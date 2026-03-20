// Background interaction: pointer and scroll responsive motion
(function () {
    'use strict';

    var CHECK_INTERVAL_MS = 100;
    var POINTER_STRENGTH = 0.78;
    var SCROLL_STRENGTH = 0.42;
    var SCROLL_VELOCITY_STRENGTH = 0.18;
    var MAX_ATTRACTOR_OFFSET = 0.82;
    var CANVAS_POINTER_SHIFT = 22;
    var CANVAS_SCROLL_SHIFT = 32;
    var CANVAS_BASE_SCALE = 1.06;

    if (typeof ii !== 'undefined' && ii && ii.particleSystem) {
        initInteraction(ii);
        return;
    }

    var checkInterval = setInterval(function () {
        if (typeof ii !== 'undefined' && ii && ii.particleSystem) {
            clearInterval(checkInterval);
            initInteraction(ii);
        }
    }, CHECK_INTERVAL_MS);

    function initInteraction(renderer) {
        var particleSystem = renderer.particleSystem;
        var canvas = document.getElementById('canvas');
        var root = document.documentElement;

        if (!particleSystem || !canvas || canvas.dataset.bgInteractive === 'true') {
            return;
        }

        canvas.dataset.bgInteractive = 'true';
        canvas.style.willChange = 'transform, opacity';
        canvas.style.transformOrigin = 'center center';

        var state = {
            targetX: 0,
            targetY: 0,
            currentX: 0,
            currentY: 0,
            scrollTarget: 0,
            scrollCurrent: 0,
            scrollVelocityTarget: 0,
            scrollVelocityCurrent: 0,
            lastScrollY: window.pageYOffset || window.scrollY || 0,
            maxScroll: 1
        };

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function lerp(start, end, factor) {
            return start + (end - start) * factor;
        }

        function resetPointer() {
            state.targetX = 0;
            state.targetY = 0;
        }

        function updatePointer(clientX, clientY) {
            var viewportWidth = Math.max(window.innerWidth, 1);
            var viewportHeight = Math.max(window.innerHeight, 1);

            state.targetX = clamp((clientX / viewportWidth) * 2 - 1, -1, 1);
            state.targetY = clamp(((clientY / viewportHeight) * 2 - 1) * -1, -1, 1);
        }

        function syncScrollState() {
            var nextScrollY = window.pageYOffset || window.scrollY || 0;
            var scrollFraction = clamp(nextScrollY / state.maxScroll, 0, 1);
            var delta = nextScrollY - state.lastScrollY;

            state.lastScrollY = nextScrollY;
            state.scrollTarget = clamp((0.5 - scrollFraction) * 2, -1, 1);
            state.scrollVelocityTarget = clamp(delta / Math.max(window.innerHeight, 1), -1, 1);

            root.style.setProperty('--fi-scroll-progress', scrollFraction.toFixed(4));
        }

        function updateScrollBounds() {
            state.maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            syncScrollState();
        }

        function handlePointerMove(event) {
            updatePointer(event.clientX, event.clientY);
        }

        function handleTouchMove(event) {
            if (!event.touches || event.touches.length === 0) {
                return;
            }

            updatePointer(event.touches[0].clientX, event.touches[0].clientY);
        }

        updateScrollBounds();

        if (window.PointerEvent) {
            window.addEventListener('pointermove', handlePointerMove, { passive: true });
            window.addEventListener('pointerup', resetPointer, { passive: true });
            window.addEventListener('pointercancel', resetPointer, { passive: true });
        } else {
            document.addEventListener('mousemove', handlePointerMove, { passive: true });
            document.addEventListener('touchmove', handleTouchMove, { passive: true });
            document.addEventListener('touchend', resetPointer, { passive: true });
        }

        window.addEventListener('scroll', syncScrollState, { passive: true });
        window.addEventListener('resize', updateScrollBounds, { passive: true });
        window.addEventListener('orientationchange', updateScrollBounds, { passive: true });
        window.addEventListener('blur', resetPointer);
        window.addEventListener('mouseout', function (event) {
            if (!event.relatedTarget) {
                resetPointer();
            }
        });

        function tick() {
            state.currentX = lerp(state.currentX, state.targetX, 0.08);
            state.currentY = lerp(state.currentY, state.targetY, 0.08);
            state.scrollCurrent = lerp(state.scrollCurrent, state.scrollTarget, 0.08);
            state.scrollVelocityCurrent = lerp(state.scrollVelocityCurrent, state.scrollVelocityTarget, 0.12);
            state.scrollVelocityTarget = lerp(state.scrollVelocityTarget, 0, 0.16);

            var attractorX = clamp(state.currentX * POINTER_STRENGTH, -MAX_ATTRACTOR_OFFSET, MAX_ATTRACTOR_OFFSET);
            var attractorY = clamp(
                state.currentY * POINTER_STRENGTH +
                state.scrollCurrent * SCROLL_STRENGTH -
                state.scrollVelocityCurrent * SCROLL_VELOCITY_STRENGTH,
                -MAX_ATTRACTOR_OFFSET,
                MAX_ATTRACTOR_OFFSET
            );

            var canvasShiftX = state.currentX * CANVAS_POINTER_SHIFT;
            var canvasShiftY =
                state.currentY * (CANVAS_POINTER_SHIFT * 0.7) -
                state.scrollCurrent * CANVAS_SCROLL_SHIFT -
                state.scrollVelocityCurrent * 12;
            var canvasScale = CANVAS_BASE_SCALE + Math.abs(state.scrollVelocityCurrent) * 0.02;
            var canvasOpacity = 0.92 + Math.min(Math.abs(state.scrollVelocityCurrent) * 0.08, 0.08);

            particleSystem.attractorPos.x = attractorX;
            particleSystem.attractorPos.y = attractorY;

            canvas.style.transform =
                'translate3d(' + canvasShiftX.toFixed(2) + 'px, ' + canvasShiftY.toFixed(2) + 'px, 0) ' +
                'scale(' + canvasScale.toFixed(3) + ')';
            canvas.style.opacity = canvasOpacity.toFixed(3);

            root.style.setProperty('--fi-bg-shift-x', canvasShiftX.toFixed(2) + 'px');
            root.style.setProperty('--fi-bg-shift-y', canvasShiftY.toFixed(2) + 'px');

            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }
})();
