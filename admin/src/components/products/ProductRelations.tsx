'use client';

import Tabs from '@/components/ui/Tabs';
import AttributeValuesTab from './AttributeValuesTab';
import ClientPricesTab from './ClientPricesTab';
import MediaTab from './MediaTab';
import PricesTab from './PricesTab';
import VariantsTab from './VariantsTab';

export default function ProductRelations({ productId }: { productId: number }) {
  return (
    <Tabs
      tabs={[
        { key: 'media', label: 'Фото', content: <MediaTab productId={productId} /> },
        { key: 'prices', label: 'Цены', content: <PricesTab productId={productId} /> },
        { key: 'client-prices', label: 'Цены клиентов', content: <ClientPricesTab productId={productId} /> },
        { key: 'attributes', label: 'Характеристики', content: <AttributeValuesTab productId={productId} /> },
        { key: 'variants', label: 'Варианты', content: <VariantsTab productId={productId} /> },
      ]}
    />
  );
}
