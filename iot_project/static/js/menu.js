document.addEventListener('DOMContentLoaded', function() {
    
  // 1. REFERENCIAS A LOS ELEMENTOS
  // Nota: Usamos los IDs que vamos a poner en el HTML en el PASO 2
  const mobileBtn = document.getElementById('mobileMenuBtn'); // Botón hamburguesa
  const sidebar = document.getElementById('sidebarNav');      // El menú lateral
  const closeBtn = document.getElementById('closeSidebar');   // Botón X dentro del menú
  const overlay = document.getElementById('sidebarOverlay');  // Fondo oscuro

  // 2. FUNCIÓN PARA ABRIR/CERRAR
  function toggleMenu() {
      if (sidebar && overlay) {
          sidebar.classList.toggle('active'); // CSS: .sidebar-nav.active { left: 0; }
          overlay.classList.toggle('active'); // CSS: .overlay.active { display: block; }
      }
  }

  // 3. EVENTOS (CLICKS)
  if (mobileBtn) {
      mobileBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Evita clics dobles accidentales
          toggleMenu();
      });
  }

  if (closeBtn) {
      closeBtn.addEventListener('click', toggleMenu);
  }

  if (overlay) {
      overlay.addEventListener('click', toggleMenu);
  }

  // --- LÓGICA DE LINK ACTIVO (MANTENIDA Y MEJORADA) ---
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.navbar-nav a');

  navLinks.forEach(link => {
      const linkPath = link.getAttribute('href');
      // Si la URL actual incluye el link (ej: /informes/ incluye /informes)
      // Y no es solo "/" a menos que estemos en el home exacto
      if (linkPath === currentPath || (linkPath !== '/' && currentPath.includes(linkPath))) {
          link.classList.add('active');
      } else {
          link.classList.remove('active');
      }
  });
});