// 글 목록(ul)을 번호 페이지네이션으로 나눠 보여주는 공통 스크립트.
// 사용법: initPagination('목록의 id', 페이지당_개수)
// 현재 페이지는 주소의 #page=2 로 유지되어 새로고침·뒤로가기 후에도 같은 페이지가 열린다.
function initPagination(listId, perPage) {
  var list = document.getElementById(listId);
  if (!list) return;

  var items = Array.prototype.slice.call(list.children);
  var totalPages = Math.ceil(items.length / perPage);
  if (totalPages <= 1) return;

  var nav = document.createElement('nav');
  nav.className = 'pager';
  nav.style.cssText = 'display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:8px; margin:2.5rem 0 3rem; text-align:center;';
  nav.setAttribute('aria-label', '페이지');
  list.insertAdjacentElement('afterend', nav);

  var m = /page=(\d+)/.exec(location.hash);
  var currentPage = m ? Math.min(Math.max(parseInt(m[1], 10), 1), totalPages) : 1;

  function makeBtn(label, page) {
    var a = document.createElement('a');
    a.href = '#page=' + page;
    a.textContent = label;
    a.style.cssText = 'display:inline-block; min-width:38px; padding:8px 12px; text-align:center; border:1px solid #dde2ea; border-radius:8px; text-decoration:none; font-size:14px; color:#4a4a4a;';
    if (page === currentPage && /^\d+$/.test(label)) {
      a.className = 'active';
      a.style.cssText += ' background:#2f6fb5; border-color:#2f6fb5; color:#fff; font-weight:700;';
    }
    a.addEventListener('click', function (e) {
      e.preventDefault();
      currentPage = page;
      history.replaceState(null, '', page === 1 ? location.pathname : '#page=' + page);
      render();
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return a;
  }

  function render() {
    items.forEach(function (el, i) {
      el.style.display = (Math.floor(i / perPage) + 1 === currentPage) ? '' : 'none';
    });
    nav.innerHTML = '';
    if (currentPage > 1) nav.appendChild(makeBtn('‹', currentPage - 1));
    for (var p = 1; p <= totalPages; p++) nav.appendChild(makeBtn(String(p), p));
    if (currentPage < totalPages) nav.appendChild(makeBtn('›', currentPage + 1));
  }

  render();
}
