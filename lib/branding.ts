export const BRANDING = {
  appName: 'Water Monitoring',
  appNameCompact: 'WATER MONITORING',
  companyNameAr: 'شركة مياه الشرب والصرف الصحي بدمياط',
  companyNameEn: 'Damietta Water and Wastewater Company',
  companyLogo: '/assets/damietta-water-company.svg',
  developerName: 'Eagle View',
  developerLogo: '/assets/eagle-view.svg',
};

export const getCompanyName = (lang: 'ar' | 'en') =>
  lang === 'ar' ? BRANDING.companyNameAr : BRANDING.companyNameEn;
