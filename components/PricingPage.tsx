import React from 'react';
import { useLanguage } from '../LanguageContext';

const CheckIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
);


const PricingCard: React.FC<{
    title: string;
    price: string;
    period: string;
    features: string[];
    popular?: boolean;
}> = ({ title, price, period, features, popular }) => {
    const { t } = useLanguage();
    return (
        <div className={`relative flex flex-col p-8 bg-gray-900 rounded-2xl shadow-xl border ${popular ? 'border-indigo-500' : 'border-gray-800'}`}>
            {popular && (
                <div className="absolute top-0 py-1.5 px-4 bg-indigo-500 rounded-full text-xs font-semibold uppercase tracking-wide text-white transform -translate-y-1/2">
                    {t('pricing.mostPopular')}
                </div>
            )}
            <h3 className="text-2xl font-semibold">{title}</h3>
            <p className="mt-4">
                <span className="text-5xl font-extrabold tracking-tight">${price}</span>
                <span className="ml-1 text-xl font-semibold text-gray-400">{period}</span>
            </p>
            <p className="mt-6 text-gray-400">{t('pricing.basicFunctionality')}</p>
            <ul className="mt-6 space-y-4 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                        <CheckIcon />
                        <span className="text-gray-300">{feature}</span>
                    </li>
                ))}
            </ul>
            <a href="#" className={`mt-8 block w-full py-3 px-6 text-center rounded-md font-medium ${popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}>
                {t('common.start')}
            </a>
        </div>
    );
};


const PricingPage: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="flex-grow flex flex-col items-center justify-center p-8 bg-black">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">{t('pricing.simpleTransparent')}</h1>
                <p className="mt-4 text-xl text-gray-400">{t('pricing.choosePlan')}</p>
            </div>
            <div className="grid max-w-5xl grid-cols-1 gap-8 mx-auto md:grid-cols-3">
                <PricingCard
                    title={t('pricing.monthly')}
                    price="15"
                    period={t('pricing.perMonth')}
                    features={[
                        t('pricing.unlimitedProjects'),
                        t('pricing.html5Exports'),
                        t('pricing.storage10gb'),
                        t('pricing.communitySupport')
                    ]}
                />
                <PricingCard
                    title={t('pricing.annual')}
                    price="120"
                    period={t('pricing.perYear')}
                    features={[
                        t('pricing.unlimitedProjects'),
                        t('pricing.html5WindowsExports'),
                        t('pricing.storage50gb'),
                        t('pricing.emailSupport'),
                        t('pricing.aiCreditsEvents')
                    ]}
                    popular={true}
                />
                <PricingCard
                    title={t('pricing.lifetime')}
                    price="499"
                    period={t('pricing.forever')}
                    features={[
                        t('pricing.allFutureExports'),
                        t('pricing.unlimitedStorage'),
                        t('pricing.prioritySupport'),
                        t('pricing.unlimitedAiCredits'),
                        t('pricing.betaAccess')
                    ]}
                />
            </div>
        </div>
    );
};

export default PricingPage;