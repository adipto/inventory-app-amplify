// src/pages/StockPage.jsx
import React, { useState, useEffect } from "react";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import Sidebar from "../components/Sidebar";
import AddStockModal from "../components/AddStockModal";
import PageHeader from "../components/PageHeader";
import DeleteConfirmModal from "../utils/DeleteConfirmModal";
import { fetchStock, deleteStockItem, fetchStockEntries } from "../utils/stockService";
import {
  LogOut, Plus, Search, Filter, ArrowUpDown,
  Download, MoreVertical, Edit, Trash2, Package, AlertCircle,
  RefreshCw, Eye
} from "lucide-react";
import AllStockEntriesTable from "../components/AllStockEntriesTable";

function StockPage() {
  // All hooks at the top
  const [activeTab, setActiveTab] = useState("wholesale"); // can be 'all', 'retail', 'wholesale'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "itemType", direction: "ascending" });
  const [showLowStock, setShowLowStock] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retailStock, setRetailStock] = useState([]);
  const [wholesaleStock, setWholesaleStock] = useState([]);
  const [error, setError] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [stockEntries, setStockEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  // Check authentication status
  const checkAuthStatus = async () => {
    try {
      const session = await fetchAuthSession();
      const authenticated = !!(session.tokens?.idToken || session.tokens?.accessToken);
      setIsAuthenticated(authenticated);

      if (!authenticated) {
        window.location.href = "/";
        return false;
      }
      return true;
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      window.location.href = "/";
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // Listen for auth events
  useEffect(() => {
    const hubListener = (data) => {
      const { event } = data.payload;
      if (event === 'signedOut') {
        setIsAuthenticated(false);
        window.location.href = "/";
      }
    };

    const unsubscribe = Hub.listen('auth', hubListener);
    return unsubscribe;
  }, []);

  // Initial auth check and data fetch
  useEffect(() => {
    const initializeApp = async () => {
      const authenticated = await checkAuthStatus();
      if (authenticated) {
        await fetchData();
        fetchEntries();
      }
    };

    initializeApp();
  }, []);

  // Fetch data when active tab changes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchData();
    }
  }, [activeTab, isAuthenticated, authLoading]);

  // Fetch all stock entries
  const fetchEntries = async () => {
    try {
      setEntriesLoading(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
      if (!idToken) return;
      const entries = await fetchStockEntries(idToken);
      setStockEntries(entries);
    } catch (err) {
      console.error("Error fetching stock entries:", err);
    } finally {
      setEntriesLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      const retailData = await fetchStock("Retail_Stock", idToken);
      setRetailStock(retailData);

      const wholesaleData = await fetchStock("Wholesale_Stock", idToken);
      setWholesaleStock(wholesaleData);

      setError(null);
    } catch (err) {
      console.error("Error fetching stock data:", err);
      setError("Failed to load stock data. Please try again later.");

      if (err.message.includes("authentication") || err.message.includes("token")) {
        setIsAuthenticated(false);
        window.location.href = "/";
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Pagination logic
  const filteredAndSortedStock =
    activeTab === "all"
      ? [...retailStock, ...wholesaleStock]
      : activeTab === "retail"
      ? retailStock
      : wholesaleStock;
  const totalItems = filteredAndSortedStock.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedStock = filteredAndSortedStock.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, showLowStock, activeTab]);

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        <span className="ml-3 text-gray-700">Checking authentication...</span>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Handlers for PageHeader filters
  const handleAllClick = () => setActiveTab("all");
  const handleRetailClick = () => setActiveTab("retail");
  const handleWholesaleClick = () => setActiveTab("wholesale");

  // Get current stock based on active tab
  const currentStock =
    activeTab === "all"
      ? [...retailStock, ...wholesaleStock]
      : activeTab === "retail"
      ? retailStock
      : wholesaleStock;
  const currentTableName = activeTab === "retail" ? "Retail_Stock" : "Wholesale_Stock";

  // Calculate total value for each item based on the stock type
  const calculateTotalValue = (item) => {
    // If showing all, try to infer type from item or default to retail logic
    if (activeTab === "all") {
      // If item has a property to distinguish, use it; fallback to retail logic
      if (item.stockType === "Wholesale" || item.from === "wholesale") {
        return item.unitPrice * item.quantity * 20;
      }
      return item.unitPrice * item.quantity;
    }
    if (activeTab === "retail") {
      return item.unitPrice * item.quantity;
    } else {
      return item.unitPrice * item.quantity * 20;
    }
  };

  const handleSearch = (e) => setSearchQuery(e.target.value);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const toggleActionsMenu = (itemId) => {
    setShowActionsMenu(showActionsMenu === itemId ? null : itemId);
  };

  const handleEditItem = (item) => {
    setItemToEdit({
      itemType: item.itemType,
      variation: item.variationName,
      stockType: activeTab === "retail" ? "Retail" : "Wholesale",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lowStockThreshold: item.lowStockThreshold,
      isEditing: true
    });
    setIsAddModalOpen(true);
    setShowActionsMenu(null);
  };

  const handleDeleteItem = (item) => {
    setItemToDelete({
      itemType: item.itemType,
      variationName: item.variationName,
    });
    setIsDeleteModalOpen(true);
    setShowActionsMenu(null);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      setIsLoading(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      await deleteStockItem(
        currentTableName,
        itemToDelete.itemType,
        itemToDelete.variationName,
        idToken
      );

      await fetchData();
      setError(null);
    } catch (err) {
      console.error("Error deleting item:", err);
      setError("Failed to delete item. Please try again later.");
    } finally {
      setIsLoading(false);
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExportData = () => {
    const headers = [
      "Item Type",
      "Variation",
      activeTab === "retail" ? "Quantity (pcs)" : "Quantity (packets)",
      "Unit Price",
      "Total Value"
    ];

    const csvData = [
      headers.join(","),
      ...filteredAndSortedStock.map(item => {
        const totalValue = calculateTotalValue(item);
        return `"${item.itemType}","${item.variationName}",${item.quantity},${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"},${totalValue.toFixed(2)}`;
      })
    ].join("\n");

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${activeTab}-stock-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Update handleAddModalClose to also fetch entries
  const handleAddModalClose = () => {
    setIsAddModalOpen(false);
    setItemToEdit(null);
    fetchEntries();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <PageHeader
          title="Stock Management"
          onAllClick={handleAllClick}
          onRetailClick={handleRetailClick}
          onWholesaleClick={handleWholesaleClick}
        />
        <main className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Stock Management</h1>
            <p className="text-gray-600">Manage your retail and wholesale inventory</p>
          </div>

          {/* Controls */}
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                {/* Tab Navigation */}
                <div className="flex rounded-lg bg-gray-100 p-1">
                  <button
                    onClick={handleAllClick}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "all"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={handleRetailClick}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "retail"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    Retail
                  </button>
                  <button
                    onClick={handleWholesaleClick}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "wholesale"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                      }`}
                  >
                    Wholesale
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
                  <button
                    onClick={() => setShowLowStock(!showLowStock)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showLowStock
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <AlertCircle size={16} className="mr-1" />
                    Low Stock
                  </button>

                  <button
                    onClick={handleExportData}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                  >
                    <Download size={16} className="mr-1" />
                    Export
                  </button>

                  <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={16} className="mr-1" />
                    Refresh
                  </button>

                  <button
                    onClick={() => {
                      setItemToEdit(null);
                      setIsAddModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    <Plus size={16} className="mr-1" />
                    New
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center text-red-700">
                <AlertCircle size={16} className="mr-2" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Stock Table with Loading and Pagination */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading stock data...</span>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => requestSort("itemType")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Item Type</span>
                            <ArrowUpDown size={14} className="text-gray-400" />
                          </div>
                        </th>
                        <th
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => requestSort("variationName")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Variation</span>
                            <ArrowUpDown size={14} className="text-gray-400" />
                          </div>
                        </th>
                        <th
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => requestSort("quantity")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Quantity</span>
                            <ArrowUpDown size={14} className="text-gray-400" />
                          </div>
                        </th>
                        <th
                          className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => requestSort("unitPrice")}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Unit Price</span>
                            <ArrowUpDown size={14} className="text-gray-400" />
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Value
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedStock.length > 0 ? (
                        paginatedStock.map((item, index) => {
                          const isLowStock = item.quantity <= item.lowStockThreshold;

                          return (
                            <tr key={item.id} className={`hover:bg-gray-50 ${isLowStock ? 'bg-amber-50' : ''}`}>
                              <td className="px-3 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{item.itemType}</div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{item.variationName}</div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-sm font-medium ${isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>
                                    {item.quantity}
                                  </span>
                                  {isLowStock && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                      Low Stock
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  ${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"}
                                </div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  ${item.totalValue.toFixed(2)}
                                </div>
                              </td>
                              <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleEditItem(item)}
                                    className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center">
                              <Package size={48} className="text-gray-400 mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No stock items found</h3>
                              <p className="text-gray-500 mb-4">
                                {searchQuery ? "Try adjusting your search terms" : "Start by adding some items to your inventory"}
                              </p>
                              <button
                                onClick={() => {
                                  setItemToEdit(null);
                                  setIsAddModalOpen(true);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                Add Stock Item
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls (Desktop) */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border bg-white text-gray-700 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1 rounded border ${page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border bg-white text-gray-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div>
                      <label className="mr-2 text-sm text-gray-600">Rows per page:</label>
                      <select
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {[5, 10, 20, 50].map((num) => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Mobile Card View */}
                <div className="md:hidden">
                  {paginatedStock.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {paginatedStock.map((item) => {
                        const isLowStock = item.quantity <= item.lowStockThreshold;

                        return (
                          <div key={item.id} className={`p-4 ${isLowStock ? "bg-amber-50" : "bg-white"}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-medium text-gray-900">{item.itemType}</h3>
                                <p className="text-sm text-gray-600">{item.variationName}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditItem(item)}
                                  className="text-blue-600 hover:text-blue-900 p-1"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-500">Quantity:</span>
                                <div className="flex items-center mt-1">
                                  <span className={`font-medium ${isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                                    {item.quantity} {activeTab === "retail" ? "pcs" : "packets"}
                                  </span>
                                  {isLowStock && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                      Low
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div>
                                <span className="text-gray-500">Unit Price:</span>
                                <p className="font-medium text-gray-900 mt-1">
                                  ${item.unitPrice ? item.unitPrice.toFixed(2) : "0.00"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Total Value:</span>
                                <span className="font-semibold text-lg text-gray-900">
                                  ${item.totalValue.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Package size={48} className="mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No stock items found</h3>
                      <p className="text-gray-500 mb-4">
                        {searchQuery ? "Try adjusting your search terms" : "Start by adding some items to your inventory"}
                      </p>
                      <button
                        onClick={() => {
                          setItemToEdit(null);
                          setIsAddModalOpen(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Add Stock Item
                      </button>
                    </div>
                  )}
                </div>

                {/* Pagination Controls (Mobile) */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center p-4 border-t bg-gray-50 md:hidden">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded border bg-white text-gray-700 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1 rounded border ${page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded border bg-white text-gray-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div>
                      <label className="mr-2 text-sm text-gray-600">Rows per page:</label>
                      <select
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {[5, 10, 20, 50].map((num) => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {/* All Stock Entries Table */}
          <h2 className="text-xl font-semibold text-gray-900 mt-12 mb-4">All Stock Entries</h2>
          <AllStockEntriesTable
            entries={stockEntries}
            onRefresh={fetchEntries}
            loading={entriesLoading}
          />
        </main>
      </div>

      {/* Modals */}
      <AddStockModal
        isOpen={isAddModalOpen}
        onClose={handleAddModalClose}
        onStockAdded={() => {
          fetchData();
          fetchEntries();
        }}
        editItem={itemToEdit}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteItem}
        itemDetails={itemToDelete}
      />
    </div>
  );
}

export default StockPage;