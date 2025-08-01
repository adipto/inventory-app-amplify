# Capital Management System

## Overview

The Capital Management system is a comprehensive financial tracking tool that automatically calculates and displays your business's capital flow, stock value, and financial performance. It integrates seamlessly with your existing transaction and stock management systems.

## Features

### 1. Automatic Financial Tracking
- **Total Capital Investment**: Fixed at $200,000 (initial investment)
- **Current Stock Value**: Automatically calculated from your stock inventory
- **Cash in Hand**: Tracks available cash after transactions and stock purchases
- **COGS for Product Sold**: Calculated from the latest transaction
- **Selling Price**: Total revenue from the latest transaction
- **Net Profit**: Automatically calculated (Selling Price - COGS)

### 2. Real-time Updates
- Updates automatically when new transactions are added
- Updates automatically when new stock is added
- Refreshes stock values from current inventory
- Tracks remaining stock value after sales

### 3. Transaction Integration
- **Retail Transactions**: 
  - COGS = Quantity × COGS per piece
  - Selling Price = Quantity × Selling price per piece
- **Wholesale Transactions**:
  - COGS = Quantity × 500 pieces per packet × COGS per piece
  - Selling Price = Quantity × Selling price per packet

### 4. Stock Integration
- Automatically calculates total stock value from retail and wholesale inventory
- Updates cash flow when new stock is purchased
- Tracks stock value changes over time

## Database Schema

### Capital_Management Table
```json
{
  "RecordID": "MAIN_RECORD",
  "TotalCapitalInvestment": "200000",
  "InitialCashInHand": "200000",
  "ValueOfCurrentStock": "0",
  "CashInHand": "0",
  "COGSForProductSold": "0",
  "SellingPrice": "0",
  "NetProfit": "0",
  "RemainingValueOfCurrentStock": "0",
  "UpdatedStock": "0",
  "LastUpdated": "2024-01-01T00:00:00.000Z"
}
```

## How It Works

### 1. Initial Setup
- System initializes with $200,000 total capital investment
- All values start at 0 except for initial capital

### 2. Transaction Processing
When a new transaction is added:
1. Calculates total COGS and selling price based on transaction type
2. Updates cash in hand (adds selling price)
3. Calculates net profit
4. Updates remaining stock value
5. Refreshes current stock value from inventory

### 3. Stock Addition
When new stock is added:
1. Calculates newly purchased stock value
2. Deducts from cash in hand
3. Updates total stock value
4. Tracks the updated stock amount

### 4. Automatic Calculations
- **Net Profit**: Selling Price - COGS
- **Remaining Stock Value**: Current Stock Value - COGS
- **Cash Flow**: Previous Cash + Selling Price - New Stock Purchases

## Usage

### Accessing Capital Management
1. Navigate to the "Capital Management" page in the sidebar
2. View the comprehensive financial overview
3. Use the "Refresh" button to manually update calculations

### Understanding the Table
- **Description**: Shows the financial event or state
- **Stock Value**: Current value of inventory
- **Cash in Hand**: Available cash
- **COGS for Product Sold**: Cost of goods sold for latest transaction
- **Selling Price**: Revenue from latest transaction
- **Net Profit**: Profit from latest transaction

### Integration Points
- **Transaction Table**: Automatically updates when transactions are added/modified
- **Stock Management**: Automatically updates when stock is added/modified
- **Real-time Sync**: All calculations happen in real-time

## Technical Implementation

### Files Created/Modified
1. `src/utils/capitalManagementService.js` - Core service functions
2. `src/components/CapitalManagementTable.jsx` - UI component
3. `src/pages/CapitalManagement.jsx` - Page wrapper
4. `src/components/AddTransactionModal.jsx` - Transaction integration
5. `src/components/AddStockModal.jsx` - Stock integration
6. `src/components/TransactionTable.jsx` - Transaction table integration
7. `src/pages/StockPage.jsx` - Stock page integration

### Key Functions
- `initializeCapitalManagement()` - Sets up initial data
- `getCapitalManagementData()` - Retrieves current data
- `updateCapitalManagementData()` - Updates database
- `calculateCurrentStockValue()` - Calculates total stock value
- `calculateLastTransactionValues()` - Calculates COGS and selling price
- `updateAfterTransaction()` - Updates after new transaction
- `updateAfterStockAddition()` - Updates after new stock
- `refreshCapitalManagement()` - Manual refresh function

## Error Handling

- Graceful error handling prevents system crashes
- Capital management errors don't affect main transaction/stock operations
- Automatic fallbacks for missing or invalid data
- Console logging for debugging

## Future Enhancements

1. **Historical Tracking**: Track capital changes over time
2. **Multiple Currencies**: Support for different currencies
3. **Advanced Analytics**: Profit margins, trends, forecasts
4. **Export Functionality**: Export reports to PDF/Excel
5. **Audit Trail**: Track all capital changes with timestamps

## Troubleshooting

### Common Issues
1. **Data not updating**: Use the "Refresh" button
2. **Incorrect calculations**: Check transaction and stock data integrity
3. **Missing data**: Ensure Capital_Management table exists in DynamoDB

### Debug Steps
1. Check browser console for error messages
2. Verify DynamoDB table permissions
3. Confirm authentication token validity
4. Check network connectivity

## Support

For issues or questions about the Capital Management system, check the console logs for detailed error messages and ensure all required DynamoDB tables are properly configured. 