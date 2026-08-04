'use client'

import Combobox from '@/components/combobox'

interface Props {
  value: string
  options: string[]
  onChange: (value: string) => void
}

// Currency dropdown — sits left of the Export button on every page that has
// one (Dashboard, Monthly, Performance). Filters sales/purchases rows down
// to a single currency (MYR/USD/SGD/...); '' means "all currencies."
export default function CurrencyFilter({ value, options, onChange }: Props) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options.map((c) => ({ id: c, name: c }))}
      placeholder="All Currencies"
      ariaLabel="Currency"
    />
  )
}
