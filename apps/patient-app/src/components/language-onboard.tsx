'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe } from 'lucide-react';

export function LanguageOnboard() {
    const { setLanguage, language } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasSelected = localStorage.getItem('language-selected');
        if (!hasSelected) {
            setIsVisible(true);
        }
    }, []);

    const handleSelect = (lang: 'en' | 'ml') => {
        setLanguage(lang);
        localStorage.setItem('language-selected', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl text-center"
                >
                    <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Globe className="h-10 w-10 text-primary" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Choose Language</h2>
                    <p className="text-slate-500 mb-8">Select your preferred language to continue</p>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <Button 
                            onClick={() => handleSelect('en')}
                            variant={language === 'en' ? 'default' : 'outline'}
                            className="h-16 rounded-2xl text-lg font-bold border-2"
                        >
                            English
                        </Button>
                        <Button 
                            onClick={() => handleSelect('ml')}
                            variant={language === 'ml' ? 'default' : 'outline'}
                            className="h-16 rounded-2xl text-lg font-bold border-2"
                        >
                            മലയാളം
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
