document.addEventListener('DOMContentLoaded', () => {
    // Auto Load Theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }

    // Mobile Menu Toggle (Basic implementation)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if(mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            alert('تم النقر على القائمة الجانبية. يمكن هنا إضافة كود لفتح قائمة الموبايل.');
        });
    }

    // Favorite Button Toggle
    const favoriteBtns = document.querySelectorAll('.favorite-btn');
    favoriteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Toggle active class
            btn.classList.toggle('active');
            
            // Toggle icon from regular to solid
            const icon = btn.querySelector('i');
            if(btn.classList.contains('active')) {
                icon.classList.remove('fa-regular');
                icon.classList.add('fa-solid');
                
                // Add a small animation effect
                icon.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    icon.style.transform = 'scale(1)';
                }, 200);
            } else {
                icon.classList.remove('fa-solid');
                icon.classList.add('fa-regular');
            }
        });
    });



    // Search Interaction
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-box input');
    
    if(searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            if(searchInput.value.trim() !== '') {
                alert('البحث عن المدرسين للغة: ' + searchInput.value);
            } else {
                searchInput.focus();
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                searchBtn.click();
            }
        });
    }
});
