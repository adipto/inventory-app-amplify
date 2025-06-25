// src/components/AddCustomerModal.jsx
import { v4 as uuidv4 } from "uuid";
import React, { Fragment, useState, useEffect } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Transition, TransitionChild } from "@headlessui/react";
import { X, User, MapPin, Mail, Phone, Users, Check } from "lucide-react";
import {
    DynamoDBClient,
    PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
    fromCognitoIdentityPool,
} from "@aws-sdk/credential-provider-cognito-identity";

const REGION = "us-east-1";
const IDENTITY_POOL_ID = "us-east-1:e6bcc9cf-e0f5-4d5a-a530-1766da1767f9";
const TABLE_NAME = "Customer_Information";

function AddCustomerModal({ isOpen, onClose, editingCustomer, refreshCustomers, userToken }) {
    const [formState, setFormState] = useState({
        name: "",
        address: "",
        customerType: "",
        email: "",
        phoneNumber: "",
    });
    const [formErrors, setFormErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Populate form when editing an existing customer
    useEffect(() => {
        if (editingCustomer) {
            setFormState({
                name: editingCustomer.Name || "",
                address: editingCustomer.Address || "",
                customerType: editingCustomer.CustomerType || "",
                email: editingCustomer.Email || "",
                phoneNumber: editingCustomer.PhoneNumber || "",
            });
        } else {
            // Reset form when adding a new customer
            setFormState({
                name: "",
                address: "",
                customerType: "",
                email: "",
                phoneNumber: "",
            });
        }
        // Clear any previous errors
        setFormErrors({});
    }, [editingCustomer, isOpen]);

    const validateField = (name, value) => {
        switch (name) {
            case "name":
                return value ? null : "Name is required";
            case "phoneNumber":
                return value ? null : "Phone number is required";
            case "customerType":
                return value ? null : "Customer type is required";
            case "email":
                if (!value) return null;
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                    ? null
                    : "Please enter a valid email";
            default:
                return null;
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState({ ...formState, [name]: value });
        if (formErrors[name]) {
            setFormErrors({ ...formErrors, [name]: null });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check if userToken is available
        if (!userToken) {
            alert("Authentication token not available. Please log in again.");
            return;
        }

        const errors = {};
        Object.keys(formState).forEach((key) => {
            const error = validateField(key, formState[key]);
            if (error) errors[key] = error;
        });
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setIsSubmitting(true);

        try {
            const credentials = fromCognitoIdentityPool({
                identityPoolId: IDENTITY_POOL_ID,
                logins: {
                    "cognito-idp.us-east-1.amazonaws.com/us-east-1_szDQpWkvh": userToken,
                },
                clientConfig: { region: REGION },
            });

            const client = new DynamoDBClient({
                region: REGION,
                credentials,
            });

            const customerData = {
                CustomerID: { S: editingCustomer ? editingCustomer.CustomerID : uuidv4() },
                Name: { S: formState.name },
                Address: { S: formState.address || "-" },
                CustomerType: { S: formState.customerType },
                Email: { S: formState.email || "-" },
                PhoneNumber: { S: formState.phoneNumber },
            };

            await client.send(
                new PutItemCommand({
                    TableName: TABLE_NAME,
                    Item: customerData,
                })
            );

            alert(editingCustomer ? "Customer updated successfully!" : "Customer added successfully!");

            // Refresh the customer list
            if (refreshCustomers) {
                refreshCustomers();
            }

            onClose();
        } catch (error) {
            console.error(`Error ${editingCustomer ? "updating" : "saving"} customer:`, error);

            // Handle specific authentication errors
            if (error.name === 'UnauthorizedException' || error.message?.includes('token')) {
                alert("Authentication error. Please log in again.");
                // Optionally redirect to login
                window.location.href = "http://localhost:5173";
            } else {
                alert(`Failed to ${editingCustomer ? "update" : "save"} customer. Please try again.`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderInput = (icon, type, name, label, isRequired) => (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {icon}
                </div>
                <input
                    type={type}
                    name={name}
                    value={formState[name]}
                    onChange={handleChange}
                    placeholder={label}
                    required={isRequired}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${formErrors[name] ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                />
            </div>
            {formErrors[name] && (
                <p className="mt-1 text-sm text-red-600">{formErrors[name]}</p>
            )}
        </div>
    );

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={onClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
                                <div className="flex items-center justify-between mb-4">
                                    <DialogTitle className="text-xl font-semibold text-gray-800">
                                        {editingCustomer ? "Edit Customer" : "Add New Customer"}
                                    </DialogTitle>
                                    <button
                                        onClick={onClose}
                                        className="p-1 rounded-full hover:bg-gray-100"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                                    {renderInput(<User size={16} className="text-gray-400" />, "text", "name", "Name", true)}
                                    {renderInput(<MapPin size={16} className="text-gray-400" />, "text", "address", "Address", false)}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Customer Type <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Users size={16} className="text-gray-400" />
                                            </div>
                                            <select
                                                name="customerType"
                                                value={formState.customerType}
                                                onChange={handleChange}
                                                required
                                                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition ${formErrors.customerType
                                                    ? "border-red-300 bg-red-50"
                                                    : "border-gray-300"
                                                    }`}
                                            >
                                                <option value="">Select Customer Type</option>
                                                <option value="Retail">Retail</option>
                                                <option value="Wholesale">Wholesale</option>
                                            </select>
                                        </div>
                                        {formErrors.customerType && (
                                            <p className="mt-1 text-sm text-red-600">{formErrors.customerType}</p>
                                        )}
                                    </div>
                                    {renderInput(<Mail size={16} className="text-gray-400" />, "email", "email", "Email", false)}
                                    {renderInput(<Phone size={16} className="text-gray-400" />, "text", "phoneNumber", "Phone Number", true)}

                                    <div className="flex items-center mt-2">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !userToken}
                                            className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? (
                                                <span className="flex items-center">
                                                    <svg
                                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        ></circle>
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                        ></path>
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : (
                                                <span className="flex items-center">
                                                    <Check size={18} className="mr-2" />
                                                    {editingCustomer ? "Update" : "Submit"}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

export default AddCustomerModal;