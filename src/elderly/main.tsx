import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HomePage } from './pages/HomePage';
import { getInitialElderlyContext, resolveElderlyContext, type ElderlyAppContext } from './services/contextService';
import { getCurrentWeather, getDefaultWeather, type WeatherInfo } from './services/weatherService';
import '../index.css';

function HomePageBootstrap() {
  const [context, setContext] = useState<ElderlyAppContext>(() => getInitialElderlyContext());
  const [weather, setWeather] = useState<WeatherInfo>(() => getDefaultWeather());

  useEffect(() => {
    let cancelled = false;

    void resolveElderlyContext().then((resolvedContext) => {
      if (!cancelled) {
        setContext(resolvedContext);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getCurrentWeather(context.familyId, context.elderlyId).then((resolvedWeather) => {
      if (!cancelled) {
        setWeather(resolvedWeather);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [context.elderlyId, context.familyId]);

  return (
    <HomePage
      familyId={context.familyId}
      elderlyId={context.elderlyId}
      elderlyName={context.elderlyName}
      weather={weather}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HomePageBootstrap />
  </React.StrictMode>
);
