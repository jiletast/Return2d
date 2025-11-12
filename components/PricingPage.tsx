import React from 'react';

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
    return (
        <div className={`relative flex flex-col p-8 bg-gray-900 rounded-2xl shadow-xl border ${popular ? 'border-indigo-500' : 'border-gray-800'}`}>
            {popular && (
                <div className="absolute top-0 py-1.5 px-4 bg-indigo-500 rounded-full text-xs font-semibold uppercase tracking-wide text-white transform -translate-y-1/2">
                    Más Popular
                </div>
            )}
            <h3 className="text-2xl font-semibold">{title}</h3>
            <p className="mt-4">
                <span className="text-5xl font-extrabold tracking-tight">${price}</span>
                <span className="ml-1 text-xl font-semibold text-gray-400">{period}</span>
            </p>
            <p className="mt-6 text-gray-400">Todas las funciones básicas para tus proyectos creativos.</p>
            <ul className="mt-6 space-y-4 flex-grow">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                        <CheckIcon />
                        <span className="text-gray-300">{feature}</span>
                    </li>
                ))}
            </ul>
            <a href="#" className={`mt-8 block w-full py-3 px-6 text-center rounded-md font-medium ${popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}>
                Comenzar
            </a>
        </div>
    );
};


const PricingPage: React.FC = () => {
    return (
        <div className="flex-grow flex items-center justify-center p-8 bg-black">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">Precios simples y transparentes</h1>
                <p className="mt-4 text-xl text-gray-400">Elige el plan adecuado para ti y tu equipo.</p>
            </div>
            <div className="grid max-w-5xl grid-cols-1 gap-8 mx-auto md:grid-cols-3">
                <PricingCard
                    title="Mensual"
                    price="15"
                    period="/mes"
                    features={['Proyectos Ilimitados', 'Exportaciones HTML5', '10GB Almacenamiento de Recursos', 'Soporte Comunitario']}
                />
                <PricingCard
                    title="Anual"
                    price="120"
                    period="/año"
                    features={['Proyectos Ilimitados', 'Exportaciones HTML5, Windows', '50GB Almacenamiento de Recursos', 'Soporte por Email', 'Créditos IA para Eventos']}
                    popular={true}
                />
                <PricingCard
                    title="Vitalicio"
                    price="499"
                    period="para siempre"
                    features={['Todas las Exportaciones Futuras', 'Almacenamiento Ilimitado de Recursos', 'Soporte Prioritario', 'Créditos IA Ilimitados', 'Acceso Beta']}
                />
            </div>
        </div>
    );
};

export default PricingPage;