import React, { useEffect } from 'react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { hexToHSL, getContrastColor } from '@/utils/colors';

export const DynamicThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const { companyProfile } = useCompanyProfile();

    useEffect(() => {
        const cachedColor = typeof localStorage !== 'undefined' ? localStorage.getItem('cached_primary_color') : null;
        const primaryColor = companyProfile?.company_primary_color || cachedColor || '#FFF200';

        // Update the --primary variable in the :root
        const root = document.documentElement;
        const hsl = hexToHSL(primaryColor);
        const foregroundHsl = getContrastColor(primaryColor);

        root.style.setProperty('--primary', hsl);
        root.style.setProperty('--primary-foreground', foregroundHsl);
        root.style.setProperty('--primary-custom', primaryColor);

        // Cache branding in localStorage for LoadingScreen (which mounts before profile fetch)
        if (companyProfile) {
            localStorage.setItem('cached_company_logo', companyProfile.company_logo_url || '');
            localStorage.setItem('cached_company_name', companyProfile.company_name || '');
            localStorage.setItem('cached_primary_color', primaryColor);
        }

        // 1. Meta theme-color for PWA
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', primaryColor);
        } else {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = primaryColor;
            document.head.appendChild(meta);
        }

        // 2. Dynamic Favicon
        const logoUrl = companyProfile?.company_logo_url;
        if (logoUrl) {
            const linkIcon = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
            if (linkIcon) {
                linkIcon.href = logoUrl;
            }
        }

        // 3. Dynamic Web Manifest for PWA
        // This allows the "App Name" and "Theme Color" to be dynamic
        const companyName = companyProfile?.company_name || 'DIRECT AI';
        const manifest = {
            name: companyName,
            short_name: companyName,
            description: `Sistema de gestão da ${companyName}`,
            theme_color: primaryColor,
            background_color: '#0a0a0a',
            display: 'standalone',
            start_url: '/',
            icons: logoUrl ? [
                { src: logoUrl, sizes: '192x192', type: 'image/png' },
                { src: logoUrl, sizes: '512x512', type: 'image/png' }
            ] : [
                { src: '/logo.png', sizes: '192x192', type: 'image/png' },
                { src: '/logo.png', sizes: '512x512', type: 'image/png' }
            ]
        };

        const stringManifest = JSON.stringify(manifest);
        const blob = new Blob([stringManifest], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        const existingManifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (existingManifest) {
            existingManifest.href = manifestURL;
        }

        return () => {
            URL.revokeObjectURL(manifestURL);
        };
    }, [companyProfile?.company_primary_color, companyProfile?.company_logo_url, companyProfile?.company_name, companyProfile]);

    return <>{children}</>;
};
