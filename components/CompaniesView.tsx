import React from 'react';
import { Language } from '../types';
import { DICTIONARY } from '../constants';
import { MetaListView } from './MetaListView';

interface CompaniesViewProps {
  lang: Language;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({ lang }) => {
  const t = DICTIONARY[lang];
  return (
    <MetaListView
      lang={lang}
      title={t.companies || 'Companies'}
      description={lang === 'ar' ? 'إدارة الشركات ديناميكياً' : 'Manage companies dynamically'}
      endpoint="/core/companies/"
      modelName="core.company"
      detailTitle={t.companyDetails || t.companies}
    />
  );
};

export default CompaniesView;
