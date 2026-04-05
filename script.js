/**
 * Riverside Auto Rental – Main JavaScript
 */

(function() {

  // ===== Mobile Navigation Toggle =====
  var menuToggle = document.getElementById('menuToggle');
  var mainNav = document.getElementById('mainNav');

  if (menuToggle && mainNav) {
    menuToggle.onclick = function() {
      if (mainNav.className.indexOf('open') === -1) {
        mainNav.className = mainNav.className + ' open';
        menuToggle.className = menuToggle.className + ' active';
        menuToggle.setAttribute('aria-expanded', 'true');
      } else {
        mainNav.className = mainNav.className.replace(' open', '');
        menuToggle.className = menuToggle.className.replace(' active', '');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    };

    var navLinks = mainNav.getElementsByTagName('a');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].onclick = function() {
        mainNav.className = mainNav.className.replace(' open', '');
        menuToggle.className = menuToggle.className.replace(' active', '');
        menuToggle.setAttribute('aria-expanded', 'false');
      };
    }
  }

  // ===== Header Scroll Shadow =====
  var header = document.getElementById('header');
  if (header) {
    window.onscroll = function() {
      if (window.scrollY > 20) {
        if (header.className.indexOf('scrolled') === -1) {
          header.className = header.className + ' scrolled';
        }
      } else {
        header.className = header.className.replace(' scrolled', '');
      }
    };
  }

  // ===== FAQ Accordion =====
  var faqButtons = document.getElementsByClassName('faq-question');
  for (var j = 0; j < faqButtons.length; j++) {
    faqButtons[j].onclick = function() {
      var parentItem = this.parentElement;
      var isActive = parentItem.className.indexOf('active') !== -1;

      // Close all
      var allItems = document.getElementsByClassName('faq-item');
      for (var k = 0; k < allItems.length; k++) {
        allItems[k].className = allItems[k].className.replace(' active', '');
        var btn = allItems[k].getElementsByClassName('faq-question')[0];
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }

      // Open clicked one
      if (!isActive) {
        parentItem.className = parentItem.className + ' active';
        this.setAttribute('aria-expanded', 'true');
      }
    };
  }

})();

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

  window.location.href = 'mail' + 'to:' + 'contact' + '@' + 'riversideautorental' + '.com?subject=' + mailtoSubject + '&body=' + mailtoBody;

  alert('Thank you! Your email client will open to send the message. For the fastest response, call us at 715-670-0209.');
}
