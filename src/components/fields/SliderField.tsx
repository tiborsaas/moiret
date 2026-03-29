import './SliderField.css';

interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}

export function SliderField({ label, value, min, max, step, onChange }: SliderFieldProps) {
    return (
        <div className="slider-field">
            <div className="slider-field__header">
                <label className="slider-field__label">{label}</label>
                <input
                    className="slider-field__number"
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                />
            </div>
            <input
                className="slider-field__range"
                type="range"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
        </div>
    );
}
