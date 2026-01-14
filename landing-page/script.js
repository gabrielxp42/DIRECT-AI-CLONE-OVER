
// DIRECT AI - LANDING PAGE INTERACTIVE SYSTEM

// Reveal animations on scroll
const revealElements = document.querySelectorAll('.feature-card, .hero-content, .hero-visual, .cta-card');

const revealOnScroll = () => {
    const triggerBottom = window.innerHeight * 0.8;

    revealElements.forEach(el => {
        const top = el.getBoundingClientRect().top;
        if (top < triggerBottom) {
            el.classList.add('reveal-active');
        }
    });
};

// Add reveal classes to CSS dynamically if needed or just use JS to inject style
const style = document.createElement('style');
style.textContent = `
    .feature-card, .hero-content, .hero-visual, .cta-card {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .reveal-active {
        opacity: 1 !important;
        transform: translateY(0) !important;
    }
`;
document.head.appendChild(style);

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

// Mobile Menu Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        // Toggle menu logic would go here
        alert('Menu Mobile - Esta funcionalidade pode ser expandida conforme a necessidade da navegação.');
    });
}

// Parallax effect for hero shapes
document.addEventListener('mousemove', (e) => {
    const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
    const moveY = (e.clientY - window.innerHeight / 2) * 0.01;

    const visual = document.querySelector('.main-preview');
    if (visual) {
        visual.style.transform = `perspective(1000px) rotateY(${moveX * 5}deg) rotateX(${-moveY * 5}deg)`;
    }
});

console.log('🚀 Direct AI Landing Page Loaded Successfully.');
