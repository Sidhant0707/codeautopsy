// Tiny in-memory stand-in for the supabase-js query builder (update/eq/or/is/lt) used by the handler.
export function makeDb(tables) {
  const matchOr = (row, expr) =>
    expr.split(',').some((cond) => {
      const [col, op, ...rest] = cond.split('.');
      const val = rest.join('.');
      if (op === 'is' && val === 'null') return row[col] == null;
      if (op === 'lt') return row[col] != null && new Date(row[col]) < new Date(val);
      if (op === 'eq') return String(row[col]) === val;
      return false;
    });
  return {
    from(name) {
      return {
        update(values) {
          const eqs = [];
          let orExpr = null;
          const q = {
            eq(c, v) { eqs.push([c, v]); return q; },
            or(e) { orExpr = e; return q; },
            then(res, rej) {
              for (const r of tables[name]) {
                if (eqs.every(([c, v]) => r[c] === v) && (!orExpr || matchOr(r, orExpr))) Object.assign(r, values);
              }
              return Promise.resolve({ data: null, error: null }).then(res, rej);
            },
          };
          return q;
        },
      };
    },
  };
}
