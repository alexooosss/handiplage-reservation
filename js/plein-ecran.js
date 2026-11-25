// js/plein-ecran.js
// Application installée (tablette de plage) : Android garde parfois la barre d'état et la barre
// de navigation au lancement ou après un changement de page, jusqu'à un glissement depuis le haut.
// Ici, la première touche à l'écran demande le vrai plein écran. Sans effet dans un navigateur
// classique (téléphone, ordinateur) : on ne force le plein écran que dans l'application installée.
(function () {
  'use strict';
  var mm = window.matchMedia;
  var installee = mm && (mm('(display-mode: fullscreen)').matches || mm('(display-mode: standalone)').matches);
  var el = document.documentElement;
  if (!installee || !el.requestFullscreen) return;

  function demander() {
    if (document.fullscreenElement) return;
    try {
      var p = el.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  // Toute touche ou tout clic : redemande le plein écran s'il a été perdu (changement de page, retour d'une autre appli)
  document.addEventListener('pointerdown', demander, true);
  document.addEventListener('keydown', demander, true);
})();
