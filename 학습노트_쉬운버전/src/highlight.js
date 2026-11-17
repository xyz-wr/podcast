// 코드 블록 간단 하이라이트: 주석 / 키워드 / 애너테이션만 색칠한다.
(function () {
  var KW = {
    sql: /\b(select|from|where|order by|group by|limit|offset|insert into|values|update|set|delete|create|index|table|on|and|or|as|desc|asc|explain|alter|add|column|primary key|not null|count|sum|like|join|interval|optimize|show|fulltext|match|against|distinct|begin|commit|rollback)\b/gi,
    java: /\b(public|private|protected|class|void|return|new|if|else|for|while|try|catch|finally|int|long|boolean|final|static|throws|throw|import|null|true|false|byte|extends|this|super|var)\b/g
  };
  var CM = {
    sql: /(^|\s)(--\s.*)$/,
    java: /(^|\s)(\/\/.*)$/,
    yaml: /(^|\s)(#.*)$/,
    sh: /(^|\s)(#.*)$/,
    nginx: /(^|\s)(#.*)$/
  };
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  document.querySelectorAll('pre[data-lang]').forEach(function (pre) {
    var lang = pre.dataset.lang;
    var out = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '').split('\n').map(function (line) {
      var code = line, cm = '';
      var re = CM[lang];
      if (re) {
        var m = re.exec(line);
        if (m) {
          var idx = m.index + m[1].length;
          code = line.slice(0, idx);
          cm = line.slice(idx);
        }
      }
      var h = esc(code);
      if (KW[lang]) h = h.replace(KW[lang], '<span class="k">$&</span>');
      if (lang === 'java') h = h.replace(/@[A-Z]\w+/g, '<span class="a">$&</span>');
      if (cm) {
        var cls = 'c';
        if (/[✗✘]/.test(cm)) cls += ' bad';
        else if (/✓/.test(cm)) cls += ' good';
        h += '<span class="' + cls + '">' + esc(cm) + '</span>';
      }
      return h;
    });
    pre.innerHTML = out.join('\n');
  });
})();
