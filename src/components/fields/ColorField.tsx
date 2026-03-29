import './ColorField.css';

interface ColorFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    allowNone?: boolean;
}

export function ColorField({ label, value, onChange, allowNone }: ColorFieldProps) {
    const isNone = value === 'none';

    return (
        <div className="color-field">
            <label className="color-field__label">{label}</label>
            <div className="color-field__controls">
                {allowNone && (
                    <button
                        className={`color-field__none-btn ${isNone ? 'active' : ''}`}
                        onClick={() => onChange(isNone ? '#ffffff' : 'none')}
                        title="Toggle none"
                    >
                        ∅
                    </button>
                )}
                {!isNone && (
                    <>
                        <input
                            className="color-field__picker"
                            type="color"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                        />
                        <span className="color-field__hex">{value}</span>
                    </>
                )}
                {isNone && <span className="color-field__hex">none</span>}
            </div>
        </div>
    );
}
