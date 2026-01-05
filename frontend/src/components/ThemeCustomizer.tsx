import { useState, useEffect } from 'react';
import { Palette, Check, Sun, Moon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '~/components/ui/popover';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { ACCENT_COLORS, DEFAULT_THEME, type ThemeConfig, type ThemeMode } from '~/lib/themes';
import { cn } from '~/lib/utils';

const THEME_STORAGE_KEY = 'llm-council-theme';

export function ThemeCustomizer() {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME);

    // Load preferences on mount
    useEffect(() => {
        const savedConfig = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig) as ThemeConfig;
                setConfig(parsed);
                applyTheme(parsed);
            } catch (e) {
                console.error("Failed to parse theme config", e);
                applyTheme(DEFAULT_THEME);
            }
        } else {
            applyTheme(DEFAULT_THEME);
        }
    }, []);

    const applyTheme = (newConfig: ThemeConfig) => {
        const root = document.documentElement;

        // Apply dark/light mode class
        if (newConfig.mode === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Apply accent color
        const accent = ACCENT_COLORS.find(c => c.name === newConfig.accent);
        if (accent) {
            const modeVars = accent.cssVars[newConfig.mode];
            Object.entries(modeVars).forEach(([key, value]) => {
                root.style.setProperty(key, value);
            });
        }
    };

    const handleAccentChange = (accentName: string) => {
        const newConfig = { ...config, accent: accentName };
        setConfig(newConfig);
        applyTheme(newConfig);
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newConfig));
    };

    const handleModeChange = (isDark: boolean) => {
        const mode: ThemeMode = isDark ? 'dark' : 'light';
        const newConfig = { ...config, mode };
        setConfig(newConfig);
        applyTheme(newConfig);
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(newConfig));
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Palette className="h-4 w-4" />
                    <span className="hidden sm:inline">Thème</span>
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-72 p-4" align="end">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium leading-none">Personnaliser</h4>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Dark/Light Mode Toggle */}
                    <div className="flex items-center justify-between">
                        <Label className="text-sm flex items-center gap-2">
                            {config.mode === 'dark' ? (
                                <Moon className="h-4 w-4" />
                            ) : (
                                <Sun className="h-4 w-4" />
                            )}
                            Mode sombre
                        </Label>
                        <Switch
                            checked={config.mode === 'dark'}
                            onCheckedChange={handleModeChange}
                        />
                    </div>

                    <div className="h-px bg-border" />

                    {/* Accent Color */}
                    <div className="space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Couleur d'accent
                        </Label>
                        <div className="grid grid-cols-5 gap-2">
                            {ACCENT_COLORS.map((color) => (
                                <button
                                    key={color.name}
                                    onClick={() => handleAccentChange(color.name)}
                                    className={cn(
                                        "group flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all hover:scale-110",
                                        config.accent === color.name
                                            ? "border-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                                            : "border-transparent hover:border-muted-foreground/50",
                                        color.activeColor
                                    )}
                                    title={color.label}
                                >
                                    {config.accent === color.name && (
                                        <Check className="h-4 w-4 text-white drop-shadow-md" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
