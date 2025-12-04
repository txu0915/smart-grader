import React, { useState } from 'react';
import { StudentInfo } from '../types';

interface StudentFormProps {
  onSubmit: (info: StudentInfo) => void;
  onCancel: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-[fadeIn_0.2s_ease-out]">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Finalize & Send</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-100 rounded-lg border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-100 rounded-lg border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="john@example.com"
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 rounded-xl text-white font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition"
              >
                Send PDF
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentForm;