export function LungsIllustration({ className }: { className?: string }) {
  const lung = 'M168 128C122 118 76 188 66 266C58 326 82 362 124 358C160 354 178 330 182 292L182 176C182 152 178 138 168 128Z'
  return (
    <svg className={className} viewBox="0 0 400 400" role="img" aria-label="Illustration of healthy lungs" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lung-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B9BFF" />
          <stop offset="1" stopColor="#0652C5" />
        </linearGradient>
        <linearGradient id="lung-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trachea-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9CC3FF" />
          <stop offset=".5" stopColor="#D6E5FF" />
          <stop offset="1" stopColor="#9CC3FF" />
        </linearGradient>
        <g id="lung-half">
          <path d={lung} fill="url(#lung-fill)" />
          <path d="M168 128C130 126 92 190 84 262C80 296 88 322 104 336C96 270 118 176 168 140Z" fill="url(#lung-shine)" />
          <g fill="none" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M190 176C170 190 150 210 134 238" />
            <path d="M150 212C140 214 126 212 112 204" />
            <path d="M138 234C128 244 118 266 114 292" />
            <path d="M160 200C158 220 156 244 150 268" />
            <path d="M144 252C132 258 118 258 104 252" />
          </g>
          <g fill="none" stroke="#FFFFFF" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round">
            <path d="M126 224C118 224 110 220 102 214" />
            <path d="M118 270C110 276 102 280 94 280" />
            <path d="M150 268C144 284 138 296 130 306" />
          </g>
        </g>
      </defs>
      <ellipse cx="200" cy="378" rx="120" ry="10" fill="#0652C5" opacity=".12" />
      <use href="#lung-half" />
      <use href="#lung-half" transform="translate(400 0) scale(-1 1)" />
      <rect x="188" y="36" width="24" height="132" rx="12" fill="url(#trachea-fill)" />
      <g stroke="#6FA2F0" strokeWidth="2" strokeLinecap="round" opacity=".8">
        <path d="M190 54H210M190 70H210M190 86H210M190 102H210M190 118H210M190 134H210" />
      </g>
      <path d="M194 164C192 178 186 184 176 190M206 164C208 178 214 184 224 190" fill="none" stroke="#D6E5FF" strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}
