import { useState, useRef, useEffect } from 'react'
import useLocationSearch from '../../hooks/useLocationSearch'
import styles from './LocationSearch.module.css'

export default function LocationSearch({ placeholder, value, onSelect, icon }) {
  const [query, setQuery] = useState(value?.display_name || '')
  const [open, setOpen] = useState(false)
  const { results, loading, search, clear } = useLocationSearch()
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        clear()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [clear])

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    search(q)
    setOpen(true)
  }

  const handleSelect = (item) => {
    const label = item.display_name || item.address?.road || item.address?.suburb || query
    setQuery(label)
    setOpen(false)
    clear()
    onSelect({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display_name: label,
      raw: item,
    })
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputRow}>
        <span className={styles.icon}>{icon}</span>
        <input
          className={styles.input}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            className={styles.clearBtn}
            onClick={() => { setQuery(''); clear(); onSelect(null) }}
            aria-label="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {open && (results.length > 0 || loading) && (
        <ul className={styles.dropdown}>
          {loading && <li className={styles.hint}>Searching…</li>}
          {results.map((item, i) => (
            <li key={i} className={styles.item} onMouseDown={() => handleSelect(item)}>
              <span className={styles.itemIcon}>📍</span>
              <div className={styles.itemText}>
                <span className={styles.itemMain}>
                  {item.address?.road || item.address?.suburb || item.display_name?.split(',')[0]}
                </span>
                <span className={styles.itemSub}>
                  {item.display_name?.split(',').slice(1, 3).join(',')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
