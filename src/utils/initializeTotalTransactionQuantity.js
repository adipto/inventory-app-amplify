// src/utils/initializeTotalTransactionQuantity.js
// This script can be run to initialize the TotalTransactionQuantity field for existing stock items
// Run this once after deploying the new TotalTransactionQuantity functionality

import { initializeTotalTransactionQuantity } from './stockService';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Initialize TotalTransactionQuantity for both Retail_Stock and Wholesale_Stock tables
 * This function should be called once to add the new field to existing items
 */
export const initializeAllStockTables = async () => {
    try {
        console.log('Starting initialization of TotalTransactionQuantity for all stock tables...');
        
        // Get authentication token
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
        
        if (!idToken) {
            throw new Error('No authentication token available');
        }
        
        // Initialize Retail_Stock table
        console.log('Initializing Retail_Stock table...');
        await initializeTotalTransactionQuantity('Retail_Stock', idToken);
        
        // Initialize Wholesale_Stock table
        console.log('Initializing Wholesale_Stock table...');
        await initializeTotalTransactionQuantity('Wholesale_Stock', idToken);
        
        console.log('Successfully initialized TotalTransactionQuantity for all stock tables!');
        
    } catch (error) {
        console.error('Error initializing TotalTransactionQuantity:', error);
        throw error;
    }
};

/**
 * Check if TotalTransactionQuantity field exists for a specific stock item
 * This can be used to verify the initialization was successful
 */
export const checkTotalTransactionQuantityField = async (tableName, itemType, variationName, token) => {
    try {
        const { getStockItem } = await import('./stockService');
        const stockItem = await getStockItem(tableName, itemType, variationName, token);
        
        if (stockItem && stockItem.totalTransactionQuantity !== undefined) {
            console.log(`✅ TotalTransactionQuantity field exists for ${itemType}-${variationName} in ${tableName}: ${stockItem.totalTransactionQuantity}`);
            return true;
        } else {
            console.log(`❌ TotalTransactionQuantity field missing for ${itemType}-${variationName} in ${tableName}`);
            return false;
        }
    } catch (error) {
        console.error(`Error checking TotalTransactionQuantity field for ${itemType}-${variationName}:`, error);
        return false;
    }
};

// Export for use in other components
export default initializeAllStockTables;
