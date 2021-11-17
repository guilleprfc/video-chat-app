import React from 'react';

import '../scss/grid.scss';
import '../scss/box.scss';

interface GridItemProps {
  title: string;
  classItem?: string;
}
const GridItem: React.FC<React.PropsWithChildren<GridItemProps>> = ({ title, classItem, children }) => {
  const className = classItem ? `item__${classItem.toLowerCase()}` : '';

  return (
    <div className={`item ${className} box`}>
      <span className='box__title'>{title}</span>
      {children}
    </div>
  );
};

const Grid: React.FC = ({ children }) => {
  return (
    <div className='grid'>
      {children}
    </div>
  );
};

const GridBitcoin: React.FC = ({ children }) => {
  return (
    <div className='grid-bitcoin'>
      {children}
    </div>
  );
};

export { Grid, GridBitcoin, GridItem };
