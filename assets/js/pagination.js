// 글 목록(ul)을 번호 페이지네이션으로 나눠 보여주는 공통 스크립트.
// 사용법: initPagination('목록의 id', 페이지당_개수)
function initPagination(listId, perPage) {
  var list = document.getElementById(listId);
  if (!list) return;

  var items = Array.prototype.slice.call(list.children);
  var totalPages = Math.ceil(items.length / perPage);
  if (totalPages <= 1) return; // 한 페이지에 다 들어가면 네비게이션 자체를 안 만듦

  var nav = document.createElement('nav');
  nav.style.cssText = 'display:flex; gap:6px; justify-content:center; margin-top:2rem; flex-wrap:wrap;';
  list.insertAdjacentElement('afterend', nav);

  var currentPage = 1;

  function makeBtn(label, page, active) {
    var a = document.createElement('a');
    a.href = '#';
    a.textContent = label;
    a.style.cssText = 'padding:6px 10px; border:1px solid ' + (active ? 'var(--accent)' : '#ddd') +
      '; border-radius:4px; text-decoration:none; cursor:pointer;' +
      (active ? ' background:var(--accent); color:#fff; font-weight:700;' : ' color:#4a4a4a;');
    a.addEventListener('click', function (e) {
      e.preventDefault();
      currentPage = page;
      render();
    });
    return a;
  }

  function render() {
    items.forEach(function (el, i) {
      var page = Math.floor(i / perPage) + 1;
      el.style.display = (page === currentPage) ? '' : 'none';
    });

    nav.innerHTML = '';
    if (currentPage > 1) nav.appendChild(makeBtn('‹', currentPage - 1, false));
    for (var p = 1; p <= totalPages; p++) {
      nav.appendChild(makeBtn(String(p), p, p === currentPage));
    }
    if (currentPage < totalPages) nav.appendChild(makeBtn('›', currentPage + 1, false));
  }

  render();
}
