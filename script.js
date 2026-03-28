/**
 * Riverside Auto Rental – Main JavaScript
 * Handles: mobile nav, FAQ accordions, header scroll, form submission
 */

document.addEventListener('DOMContentLoaded', function () {

  // ===== Mobile Navigation Toggle =====
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', function () {
      const isOpen = mainNav.classList.toggle('open');
      menuToggle.classList.toggle('active');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close nav when clicking a link
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('open');
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ===== Header Scroll Shadow =====
  const header = document.getElementById('header');
  if (header) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // ===== FAQ Accordion =====
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', function () {
        const isActive = item.classList.contains('active');

        // Close all others
        faqItems.forEach(function (other) {
          other.classList.remove('active');
          var btn = other.querySelector('.faq-question');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });

        // Toggle current
        if (!isActive) {
          item.classList.add('active');
          question.setAttribute('aria-expanded', 'true');
        }
      });
    }
  });

  // ===== Smooth Scroll for Anchor Links =====
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ===== Intersection Observer for Scroll Animations =====
  if ('IntersectionObserver' in window) {
    var animatedElements = document.querySelectorAll(
      '.vehicle-card, .audience-block, .need-card, .van-spotlight, .insurance-section, .heritage'
    );

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    animatedElements.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

});

// ===== Contact Form Handler =====
function handleFormSubmit(e) {
  e.preventDefault();

  var name = document.getElementById('name');
  var email = document.getElementById('email');
  var message = document.getElementById('message');

  if (!name || !name.value.trim()) {
    alert('Please enter your name.');
    return;
  }
  if (!email || !email.value.trim()) {
    alert('Please enter your email address.');
    return;
  }

  // In production, replace with actual form endpoint (Netlify Forms, Formspree, etc.)
  // For now, construct a mailto link as fallback
  var subject = document.getElementById('subject');
  var phone = document.getElementById('phone');

  var mailtoSubject = encodeURIComponent('Rental Inquiry from ' + name.value.trim());
  var mailtoBody = encodeURIComponent(
    'Name: ' + name.value.trim() + '\n' +
    'Email: ' + email.value.trim() + '\n' +
    'Phone: ' + (phone ? phone.value.trim() : 'Not provided') + '\n' +
    'Topic: ' + (subject ? subject.value : 'Not selected') + '\n\n' +
    'Message:\n' + (message ? message.value.trim() : 'No message')
  );

  window.location.href = 'mailto:contact@riversideautorental.com?subject=' + mailtoSubject + '&body=' + mailtoBody;

  alert('Thank you! Your email client will open to send the message. For the fastest response, call us at 715-670-0209.');
}
