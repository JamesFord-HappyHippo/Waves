/**
 * Waves Marine Navigation - Interactive JavaScript
 * 
 * Custom JavaScript functionality for marine-themed interactions,
 * animations, and enhanced user experience features.
 */

class WavesMarineApp {
    constructor() {
        this.init();
        this.bindEvents();
        this.initializeAnimations();
        this.setupIntersectionObservers();
    }

    init() {
        console.log('🌊 Waves Marine Navigation App Initialized');
        
        // Initialize app state
        this.state = {
            isLoading: false,
            activeSection: 'home',
            userAgent: this.detectDevice(),
            scrollPosition: 0,
            animations: {
                enabled: !window.matchMedia('(prefers-reduced-motion: reduce)').matches
            }
        };

        // Initialize components after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeComponents();
            });
        } else {
            this.initializeComponents();
        }
    }

    initializeComponents() {
        this.setupNavigation();
        this.setupDownloadButtons();
        this.setupScrollEffects();
        this.setupFormValidation();
        this.setupAccessibility();
        
        // Initialize specific page components based on current page
        const currentPage = this.getCurrentPage();
        switch(currentPage) {
            case 'index':
                this.initializeHomePage();
                break;
            case 'features':
                this.initializeFeaturesPage();
                break;
            case 'about':
                this.initializeAboutPage();
                break;
        }
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('features')) return 'features';
        if (path.includes('about')) return 'about';
        return 'index';
    }

    bindEvents() {
        // Window events
        window.addEventListener('scroll', this.throttle(this.handleScroll.bind(this), 16));
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 250));
        window.addEventListener('load', this.handlePageLoad.bind(this));

        // Navigation events
        document.addEventListener('click', this.handleNavigation.bind(this));
        
        // Touch events for mobile
        if (this.state.userAgent.isMobile) {
            this.setupTouchEvents();
        }
    }

    // ==========================================
    // NAVIGATION & ROUTING
    // ==========================================

    setupNavigation() {
        const navbar = document.querySelector('nav');
        const navToggle = document.querySelector('[data-collapse-toggle]');
        const navMenu = document.querySelector('#navbar-sticky');

        if (navToggle && navMenu) {
            navToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
                
                navToggle.setAttribute('aria-expanded', !isExpanded);
                navMenu.classList.toggle('hidden');
                
                // Add mobile menu styling
                if (!isExpanded) {
                    navMenu.classList.add('mobile-nav');
                    this.animateMenuOpen(navMenu);
                } else {
                    this.animateMenuClose(navMenu);
                }
            });
        }

        // Smooth scroll for anchor links
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(link => {
            link.addEventListener('click', this.handleAnchorClick.bind(this));
        });

        // Update active nav item based on scroll position
        this.updateActiveNavItem();
    }

    handleNavigation(e) {
        const link = e.target.closest('a');
        if (!link) return;

        // Handle external links
        if (link.hostname !== window.location.hostname) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        }

        // Track navigation analytics
        this.trackEvent('navigation', {
            from: window.location.pathname,
            to: link.href,
            text: link.textContent.trim()
        });
    }

    handleAnchorClick(e) {
        const targetId = e.currentTarget.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            e.preventDefault();
            this.smoothScrollTo(targetElement);
        }
    }

    smoothScrollTo(element, offset = 80) {
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        if (this.state.animations.enabled) {
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        } else {
            window.scrollTo(0, offsetPosition);
        }
    }

    // ==========================================
    // DOWNLOAD FUNCTIONALITY
    // ==========================================

    setupDownloadButtons() {
        const downloadButtons = document.querySelectorAll('a[href="#"], button:contains("Download")');
        
        downloadButtons.forEach(button => {
            if (button.textContent.includes('iOS') || button.textContent.includes('Apple')) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleDownload('ios');
                });
            } else if (button.textContent.includes('Android')) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleDownload('android');
                });
            }
        });
    }

    handleDownload(platform) {
        // Show download modal or redirect based on platform
        const userAgent = this.state.userAgent;
        
        if (userAgent.isMobile) {
            // Direct to app store
            if (platform === 'ios' && userAgent.isIOS) {
                this.redirectToAppStore('ios');
            } else if (platform === 'android' && userAgent.isAndroid) {
                this.redirectToAppStore('android');
            } else {
                this.showDownloadModal(platform);
            }
        } else {
            // Show QR code modal for desktop users
            this.showQRCodeModal(platform);
        }

        // Track download attempt
        this.trackEvent('download_attempt', {
            platform: platform,
            userAgent: userAgent,
            page: this.getCurrentPage()
        });
    }

    redirectToAppStore(platform) {
        const urls = {
            ios: 'https://apps.apple.com/app/waves-marine-navigation/id123456789',
            android: 'https://play.google.com/store/apps/details?id=com.waves.marine'
        };
        
        window.location.href = urls[platform];
    }

    showDownloadModal(platform) {
        const modal = this.createDownloadModal(platform);
        document.body.appendChild(modal);
        
        // Use Flowbite modal functionality
        const modalInstance = new Modal(modal);
        modalInstance.show();
    }

    showQRCodeModal(platform) {
        const modal = this.createQRCodeModal(platform);
        document.body.appendChild(modal);
        
        const modalInstance = new Modal(modal);
        modalInstance.show();
    }

    createDownloadModal(platform) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-md w-full p-6 marine-shadow">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold marine-gradient-text">Download Waves for ${platform.toUpperCase()}</h3>
                    <button class="text-gray-400 hover:text-gray-600" onclick="this.closest('.fixed').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="text-center">
                    <div class="mb-4">
                        <i class="fab fa-${platform === 'ios' ? 'apple' : 'android'} text-4xl text-ocean-blue-600"></i>
                    </div>
                    <p class="mb-6 text-gray-600">
                        The Waves app is coming soon to ${platform === 'ios' ? 'iOS' : 'Android'}! 
                        Join our waitlist to be notified when it's available.
                    </p>
                    <div class="space-y-3">
                        <button class="w-full btn-marine-primary py-3 px-6 rounded-lg text-white font-medium">
                            Join Waitlist
                        </button>
                        <button class="w-full text-gray-500 hover:text-gray-700" onclick="this.closest('.fixed').remove()">
                            Maybe Later
                        </button>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    createQRCodeModal(platform) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-sm w-full p-6 marine-shadow text-center">
                <div class="mb-4">
                    <h3 class="text-xl font-bold marine-gradient-text mb-2">Scan to Download</h3>
                    <p class="text-gray-600 text-sm">Scan with your ${platform === 'ios' ? 'iPhone' : 'Android device'}</p>
                </div>
                <div class="bg-gray-100 p-4 rounded-lg mb-4">
                    <div class="w-32 h-32 bg-gray-300 mx-auto rounded flex items-center justify-center">
                        <i class="fas fa-qrcode text-4xl text-gray-500"></i>
                    </div>
                </div>
                <button class="text-gray-500 hover:text-gray-700 text-sm" onclick="this.closest('.fixed').remove()">
                    Close
                </button>
            </div>
        `;
        return modal;
    }

    // ==========================================
    // SCROLL EFFECTS & ANIMATIONS
    // ==========================================

    setupScrollEffects() {
        if (!this.state.animations.enabled) return;

        // Parallax effect for hero sections
        const heroSections = document.querySelectorAll('.hero-gradient, .parallax-bg');
        heroSections.forEach(section => {
            this.setupParallax(section);
        });

        // Navbar background on scroll
        this.setupNavbarScroll();
    }

    setupParallax(element) {
        if (!element) return;
        
        const parallaxIntensity = 0.3;
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset;
            const rate = scrollTop * -parallaxIntensity;
            
            if (scrollTop <= element.offsetHeight) {
                element.style.transform = `translateY(${rate}px)`;
            }
        });
    }

    setupNavbarScroll() {
        const navbar = document.querySelector('nav');
        if (!navbar) return;

        let lastScrollTop = 0;
        const scrollThreshold = 100;

        window.addEventListener('scroll', () => {
            const currentScrollTop = window.pageYOffset;
            
            if (currentScrollTop > scrollThreshold) {
                navbar.classList.add('scrolled');
                
                // Hide navbar on scroll down, show on scroll up
                if (currentScrollTop > lastScrollTop && currentScrollTop > 200) {
                    navbar.style.transform = 'translateY(-100%)';
                } else {
                    navbar.style.transform = 'translateY(0)';
                }
            } else {
                navbar.classList.remove('scrolled');
                navbar.style.transform = 'translateY(0)';
            }
            
            lastScrollTop = currentScrollTop;
        });
    }

    handleScroll() {
        this.state.scrollPosition = window.pageYOffset;
        this.updateActiveNavItem();
        
        // Update progress indicator if it exists
        this.updateReadingProgress();
    }

    updateActiveNavItem() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('nav a[href^="#"]');
        
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.getBoundingClientRect().top;
            if (sectionTop <= 100) {
                currentSection = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').substring(1) === currentSection) {
                link.classList.add('active');
            }
        });
    }

    updateReadingProgress() {
        const progressBar = document.querySelector('.reading-progress');
        if (!progressBar) return;

        const scrollTop = window.pageYOffset;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (scrollTop / documentHeight) * 100;
        
        progressBar.style.width = `${progress}%`;
    }

    // ==========================================
    // INTERSECTION OBSERVER ANIMATIONS
    // ==========================================

    setupIntersectionObservers() {
        if (!this.state.animations.enabled) return;

        // Fade in animations for cards and sections
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target);
                }
            });
        }, observerOptions);

        // Observe elements for animation
        const animateElements = document.querySelectorAll(
            '.feature-card, .testimonial-card, .stat-number, h2, h3'
        );
        
        animateElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            observer.observe(el);
        });
    }

    animateElement(element) {
        if (!this.state.animations.enabled) {
            element.style.opacity = '1';
            element.style.transform = 'none';
            return;
        }

        element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        
        // Add stagger effect for cards
        if (element.classList.contains('feature-card')) {
            const delay = Array.from(element.parentElement.children).indexOf(element) * 0.1;
            element.style.transitionDelay = `${delay}s`;
        }
    }

    initializeAnimations() {
        if (!this.state.animations.enabled) return;

        // Initialize wave logo animation
        const logos = document.querySelectorAll('.marine-logo');
        logos.forEach(logo => {
            logo.addEventListener('mouseenter', () => {
                if (this.state.animations.enabled) {
                    logo.style.animationDuration = '0.5s';
                    logo.style.animationIterationCount = '3';
                }
            });
            
            logo.addEventListener('mouseleave', () => {
                logo.style.animationDuration = '3s';
                logo.style.animationIterationCount = 'infinite';
            });
        });
    }

    // ==========================================
    // PAGE-SPECIFIC INITIALIZATIONS
    // ==========================================

    initializeHomePage() {
        // Initialize hero animations
        this.initializeHeroAnimations();
        
        // Setup feature cards interactions
        this.setupFeatureCards();
        
        // Initialize testimonials carousel
        this.initializeTestimonials();
        
        // Setup CTA animations
        this.setupCTAAnimations();
    }

    initializeFeaturesPage() {
        // Initialize comparison table interactions
        this.setupComparisonTable();
        
        // Setup feature demonstrations
        this.setupFeatureDemos();
        
        // Initialize technology stack animations
        this.setupTechnologyAnimations();
    }

    initializeAboutPage() {
        // Initialize statistics counter animations
        this.initializeStatsCounter();
        
        // Setup team member interactions
        this.setupTeamInteractions();
        
        // Initialize mission section animations
        this.setupMissionAnimations();
    }

    initializeHeroAnimations() {
        const hero = document.querySelector('.hero-gradient');
        if (!hero || !this.state.animations.enabled) return;

        // Add floating animation to download buttons
        const ctaButtons = hero.querySelectorAll('a[class*="btn"], button');
        ctaButtons.forEach((button, index) => {
            button.style.animationDelay = `${index * 0.2}s`;
            button.classList.add('animate-fade-in-up');
        });
    }

    setupFeatureCards() {
        const featureCards = document.querySelectorAll('.feature-card');
        
        featureCards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                if (this.state.animations.enabled) {
                    const icon = card.querySelector('.icon-wrapper');
                    if (icon) {
                        icon.style.animation = 'depth-pulse 1s ease-in-out infinite';
                    }
                }
            });
            
            card.addEventListener('mouseleave', () => {
                const icon = card.querySelector('.icon-wrapper');
                if (icon) {
                    icon.style.animation = '';
                }
            });
            
            // Add click interaction for mobile
            card.addEventListener('click', () => {
                this.trackEvent('feature_interaction', {
                    feature: card.querySelector('h3')?.textContent || 'unknown',
                    page: this.getCurrentPage()
                });
            });
        });
    }

    initializeStatsCounter() {
        const statNumbers = document.querySelectorAll('.stat-number');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateCounter(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        statNumbers.forEach(stat => observer.observe(stat));
    }

    animateCounter(element) {
        const target = parseInt(element.textContent.replace(/[^\d]/g, ''));
        const duration = 2000; // 2 seconds
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.floor(progress * target);
            
            // Format number with appropriate suffix
            const suffix = element.textContent.includes('K') ? 'K' : 
                          element.textContent.includes('M') ? 'M' : '';
            const displayValue = suffix ? (current / (suffix === 'K' ? 1000 : 1000000)).toFixed(1) + suffix : current;
            
            element.textContent = displayValue + (element.textContent.includes('+') ? '+' : '');
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    // ==========================================
    // FORM HANDLING & VALIDATION
    // ==========================================

    setupFormValidation() {
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            form.addEventListener('submit', this.handleFormSubmit.bind(this));
            
            // Add real-time validation
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            inputs.forEach(input => {
                input.addEventListener('blur', () => this.validateField(input));
                input.addEventListener('input', () => this.clearFieldError(input));
            });
        });
    }

    handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        if (this.validateForm(form)) {
            this.submitForm(form);
        }
    }

    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input[required], textarea[required]');
        
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    validateField(field) {
        const value = field.value.trim();
        const type = field.type;
        let isValid = true;
        let message = '';
        
        if (!value) {
            isValid = false;
            message = 'This field is required';
        } else if (type === 'email' && !this.isValidEmail(value)) {
            isValid = false;
            message = 'Please enter a valid email address';
        }
        
        if (isValid) {
            this.clearFieldError(field);
        } else {
            this.showFieldError(field, message);
        }
        
        return isValid;
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('border-red-500');
        
        const error = document.createElement('div');
        error.className = 'text-red-500 text-sm mt-1 field-error';
        error.textContent = message;
        
        field.parentNode.appendChild(error);
    }

    clearFieldError(field) {
        field.classList.remove('border-red-500');
        const error = field.parentNode.querySelector('.field-error');
        if (error) {
            error.remove();
        }
    }

    async submitForm(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Show loading state
        this.showFormLoading(form);
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showFormSuccess(form);
            this.trackEvent('form_submit', {
                form: form.id || 'unknown',
                page: this.getCurrentPage()
            });
        } catch (error) {
            this.showFormError(form, 'Something went wrong. Please try again.');
        }
    }

    showFormLoading(form) {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="marine-spinner w-4 h-4 mr-2"></i>Submitting...';
        }
    }

    showFormSuccess(form) {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-check mr-2"></i>Thank you!';
            button.className = button.className.replace('btn-marine-primary', 'success-marine');
        }
        
        form.reset();
        
        setTimeout(() => {
            if (button) {
                button.innerHTML = 'Submit';
                button.className = button.className.replace('success-marine', 'btn-marine-primary');
            }
        }, 3000);
    }

    showFormError(form, message) {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.disabled = false;
            button.innerHTML = 'Submit';
        }
        
        // Show error message
        const existingError = form.querySelector('.form-error');
        if (existingError) existingError.remove();
        
        const error = document.createElement('div');
        error.className = 'error-marine form-error mt-4 text-center';
        error.textContent = message;
        
        form.appendChild(error);
        
        setTimeout(() => error.remove(), 5000);
    }

    // ==========================================
    // ACCESSIBILITY FEATURES
    // ==========================================

    setupAccessibility() {
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
        
        // Focus management
        this.setupFocusManagement();
        
        // ARIA live regions for dynamic content
        this.setupLiveRegions();
        
        // Skip to content link
        this.setupSkipToContent();
    }

    handleKeyboardNavigation(e) {
        // Escape key to close modals
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not(.hidden)');
            if (openModal) {
                this.closeModal(openModal);
            }
        }
        
        // Tab navigation enhancements
        if (e.key === 'Tab') {
            this.handleTabNavigation(e);
        }
    }

    setupFocusManagement() {
        // Ensure interactive elements are properly focusable
        const interactiveElements = document.querySelectorAll(
            'button, a, input, textarea, select, [tabindex]'
        );
        
        interactiveElements.forEach(element => {
            if (!element.getAttribute('tabindex') && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
                element.setAttribute('tabindex', '0');
            }
        });
    }

    setupLiveRegions() {
        // Create live region for announcements
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.id = 'live-region';
        document.body.appendChild(liveRegion);
    }

    announce(message) {
        const liveRegion = document.getElementById('live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => liveRegion.textContent = '', 1000);
        }
    }

    setupSkipToContent() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-to-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: var(--ocean-blue-600);
            color: white;
            padding: 8px;
            text-decoration: none;
            border-radius: 4px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s, top 0.3s;
        `;
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
            skipLink.style.opacity = '1';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
            skipLink.style.opacity = '0';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    // ==========================================
    // TOUCH & MOBILE INTERACTIONS
    // ==========================================

    setupTouchEvents() {
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchStartX - touchEndX;
            const deltaY = touchStartY - touchEndY;
            
            // Handle swipe gestures
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (Math.abs(deltaX) > 50) {
                    if (deltaX > 0) {
                        this.handleSwipe('left');
                    } else {
                        this.handleSwipe('right');
                    }
                }
            }
            
            touchStartX = 0;
            touchStartY = 0;
        }, { passive: true });
    }

    handleSwipe(direction) {
        // Handle swipe navigation between pages
        const currentPage = this.getCurrentPage();
        const pages = ['index', 'features', 'about'];
        const currentIndex = pages.indexOf(currentPage);
        
        if (direction === 'left' && currentIndex < pages.length - 1) {
            // Swipe to next page
            window.location.href = pages[currentIndex + 1] + '.html';
        } else if (direction === 'right' && currentIndex > 0) {
            // Swipe to previous page
            window.location.href = pages[currentIndex - 1] === 'index' ? 'index.html' : pages[currentIndex - 1] + '.html';
        }
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    detectDevice() {
        const userAgent = navigator.userAgent;
        return {
            isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
            isIOS: /iPad|iPhone|iPod/.test(userAgent),
            isAndroid: /Android/.test(userAgent),
            isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
            isChrome: /Chrome/.test(userAgent),
            isFirefox: /Firefox/.test(userAgent)
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    handleResize() {
        // Recalculate animations and layouts on resize
        this.state.userAgent = this.detectDevice();
        
        // Update any size-dependent features
        this.updateResponsiveFeatures();
    }

    updateResponsiveFeatures() {
        // Update navigation for mobile/desktop
        const navMenu = document.querySelector('#navbar-sticky');
        if (window.innerWidth >= 768 && navMenu) {
            navMenu.classList.remove('hidden', 'mobile-nav');
        }
    }

    handlePageLoad() {
        // Page load complete
        document.body.classList.add('loaded');
        
        // Initialize any page-load dependent features
        this.initializeLoadDependentFeatures();
        
        // Preload critical resources
        this.preloadResources();
    }

    initializeLoadDependentFeatures() {
        // Features that require full page load
        this.optimizeImages();
        this.setupServiceWorker();
    }

    optimizeImages() {
        // Lazy loading for images
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.add('fade-in');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    }

    preloadResources() {
        // Preload critical pages and resources
        const criticalResources = [
            '/features.html',
            '/about.html',
            'https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = resource;
            document.head.appendChild(link);
        });
    }

    trackEvent(eventName, data = {}) {
        // Analytics tracking (placeholder for Google Analytics, etc.)
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, data);
        }
        
        // Custom analytics
        console.log('📊 Event tracked:', eventName, data);
        
        // Could integrate with analytics services here
        this.sendToAnalytics(eventName, data);
    }

    sendToAnalytics(event, data) {
        // Placeholder for analytics integration
        // Could send to Google Analytics, Mixpanel, etc.
        
        if (window.dataLayer) {
            window.dataLayer.push({
                event: event,
                ...data
            });
        }
    }
}

// ==========================================
// INITIALIZE APP
// ==========================================

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.wavesApp = new WavesMarineApp();
    });
} else {
    window.wavesApp = new WavesMarineApp();
}

// ==========================================
// GLOBAL UTILITIES
// ==========================================

// Make some utilities globally available
window.WavesUtils = {
    smoothScrollTo: function(element, offset = 80) {
        if (window.wavesApp) {
            window.wavesApp.smoothScrollTo(element, offset);
        }
    },
    
    announce: function(message) {
        if (window.wavesApp) {
            window.wavesApp.announce(message);
        }
    },
    
    trackEvent: function(eventName, data) {
        if (window.wavesApp) {
            window.wavesApp.trackEvent(eventName, data);
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WavesMarineApp;
}

console.log('🌊 Waves Marine Navigation - JavaScript Loaded Successfully');