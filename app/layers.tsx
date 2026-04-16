import { Redirect } from 'expo-router';

import { LAYERS_TAB_ROUTE } from '../src/navigation/routes';

export default function LegacyLayersRoute() {
  return <Redirect href={LAYERS_TAB_ROUTE} />;
}
