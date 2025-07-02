// src/pages/CustomerList.jsx
import React, { useState, useEffect } from "react";
import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import AddCustomerModal from "../components/AddCustomerModal";
import { UserPlus, Pencil, Trash2, Filter, Search, Phone, Mail, MapPin } from "lucide-react";
import { createDynamoDBClient } from "../aws/aws-config";
import { ScanCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

function CustomerList() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userToken, setUserToken] = useState(null);

    // Check authentication status
    const checkAuthStatus = async () => {
        try {
            const user = await getCurrentUser();
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();

            if (user && idToken) {
                setIsAuthenticated(true);
                setUserToken(idToken);
            } else {
                setIsAuthenticated(false);
                // Redirect to login page
                window.location.href = "http://localhost:5173";
            }
        } catch (error) {
            console.error("Authentication check failed:", error);
            setIsAuthenticated(false);
            // Redirect to login page
            window.location.href = "http://localhost:5173";
        } finally {
            setIsLoading(false);
        }
    };

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleRetailClick = () => setActiveFilter("retail");
    const handleWholesaleClick = () => setActiveFilter("wholesale");
    const handleResetFilter = () => setActiveFilter("all");

    const fetchCustomers = async () => {
        if (!userToken) return;

        try {
            const dynamoClient = createDynamoDBClient(userToken);
            const command = new ScanCommand({ TableName: "Customer_Information" });
            const response = await dynamoClient.send(command);
            const items = response.Items.map((item) => unmarshall(item));
            setCustomers(items);
        } catch (error) {
            console.error("Error fetching customers:", error);
            // If token is invalid, try to refresh
            if (error.name === 'UnauthorizedException' || error.message?.includes('token')) {
                await checkAuthStatus();
            }
        }
    };

    const handleDelete = async (customer) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete customer "${customer.Name}"?`
        );
        if (!confirmed) return;

        try {
            const dynamoClient = createDynamoDBClient(userToken);
            const deleteCmd = new DeleteItemCommand({
                TableName: "Customer_Information",
                Key: { CustomerID: { S: customer.CustomerID } },
            });
            await dynamoClient.send(deleteCmd);
            fetchCustomers();
        } catch (error) {
            console.error("Delete error:", error);
            // If token is invalid, try to refresh
            if (error.name === 'UnauthorizedException' || error.message?.includes('token')) {
                await checkAuthStatus();
            }
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setIsModalOpen(true);
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            window.location.href = "http://localhost:5173";
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    useEffect(() => {
        checkAuthStatus();
    }, []);

    useEffect(() => {
        if (isAuthenticated && userToken) {
            fetchCustomers();
        }
    }, [isAuthenticated, userToken]);

    // Show loading spinner while checking authentication
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-500">Loading authentication...</div>
            </div>
        );
    }

    // If not authenticated, don't render anything (redirect will happen)
    if (!isAuthenticated) {
        return null;
    }

    const filteredCustomers = customers.filter((c) => {
        const matchesType =
            activeFilter === "all" ||
            (activeFilter === "retail" && c.CustomerType === "Retail") ||
            (activeFilter === "wholesale" && c.CustomerType === "Wholesale");

        const matchesSearch =
            c.Name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.PhoneNumber?.includes(searchQuery);

        return matchesType && matchesSearch;
    });

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar onSignOut={handleSignOut} />

            <div className="flex-1 overflow-auto">
                <PageHeader
                    title="Customers List"
                    onRetailClick={handleRetailClick}
                    onWholesaleClick={handleWholesaleClick}
                />

                <main className="p-3 sm:p-6 max-w-7xl mx-auto">
                    {/* Filter + Search */}
                    <div className="mb-4 sm:mb-6 bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                        <div className="space-y-3 sm:space-y-0 sm:flex sm:justify-between sm:items-center sm:gap-4">
                            <div className="space-y-2">
                                <h2 className="text-lg font-medium text-gray-700">
                                    Customer Database
                                </h2>
                                <div className="flex items-center bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                                    <button
                                        onClick={handleResetFilter}
                                        className={`flex-1 sm:flex-none px-3 py-1.5 text-sm rounded-md transition-colors ${activeFilter === "all"
                                            ? "bg-white text-blue-600 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={handleRetailClick}
                                        className={`flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 text-sm rounded-md transition-colors ${activeFilter === "retail"
                                            ? "bg-white text-blue-600 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        <Filter size={14} className="mr-1" />
                                        Retail
                                    </button>
                                    <button
                                        onClick={handleWholesaleClick}
                                        className={`flex-1 sm:flex-none flex items-center justify-center px-3 py-1.5 text-sm rounded-md transition-colors ${activeFilter === "wholesale"
                                            ? "bg-white text-blue-600 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-200"
                                            }`}
                                    >
                                        <Filter size={14} className="mr-1" />
                                        Wholesale
                                    </button>
                                </div>
                            </div>

                            <div className="relative w-full sm:max-w-xs">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={16} className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search customers..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Phone
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Address
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredCustomers.map((cust) => (
                                    <tr key={cust.CustomerID}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cust.Name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${cust.CustomerType === 'Retail'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {cust.CustomerType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.Email || "—"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cust.PhoneNumber}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={cust.Address}>{cust.Address || "—"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex gap-3 justify-center">
                                                <button
                                                    onClick={() => handleEdit(cust)}
                                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cust)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {filteredCustomers.map((cust) => (
                            <div key={cust.CustomerID} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">{cust.Name}</h3>
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${cust.CustomerType === 'Retail'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-blue-100 text-blue-800'
                                            }`}>
                                            {cust.CustomerType}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(cust)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cust)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Phone size={14} className="mr-2 text-gray-400" />
                                        {cust.PhoneNumber}
                                    </div>
                                    {cust.Email && (
                                        <div className="flex items-center text-sm text-gray-600">
                                            <Mail size={14} className="mr-2 text-gray-400" />
                                            {cust.Email}
                                        </div>
                                    )}
                                    {cust.Address && (
                                        <div className="flex items-start text-sm text-gray-600">
                                            <MapPin size={14} className="mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                                            <span className="break-words">{cust.Address}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredCustomers.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                No customers found matching your criteria.
                            </div>
                        )}
                    </div>

                    {/* Add Button */}
                    <div className="mt-6 text-center">
                        <button
                            onClick={openModal}
                            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                        >
                            <UserPlus size={18} className="inline mr-2" />
                            Add New Customer
                        </button>
                    </div>

                    {/* Modal */}
                    <AddCustomerModal
                        isOpen={isModalOpen}
                        onClose={closeModal}
                        editingCustomer={editingCustomer}
                        refreshCustomers={fetchCustomers}
                        userToken={userToken}
                    />
                </main>
            </div>
        </div>
    );
}

export default CustomerList;