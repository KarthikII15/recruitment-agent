import React, { createContext, useState, useContext } from 'react';

const DashboardContext = createContext();

export const DashboardProvider = ({ children }) => {
  const [globalFilter, setGlobalFilter] = useState('');

  return (
    <DashboardContext.Provider value={{ globalFilter, setGlobalFilter }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);