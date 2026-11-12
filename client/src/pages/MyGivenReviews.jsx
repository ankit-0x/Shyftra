// client/src/pages/MyGivenReviews.jsx
import { Link } from "react-router";
import MyReviewsList from "../components/MyReviewsList";
import { ArrowLeft, Star } from "lucide-react";

function MyGivenReviews() {
  return (
    <div className="min-h-screen bg-base-200/50 p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        
        {/* Navigation & Header */}
        <div>
          <Link 
            to="/profile" 
            className="inline-flex items-center gap-1.5 text-sm font-medium text-base-content/60 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to profile
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-base-content">
                Reviews I've Given
              </h1>
              <p className="text-base-content/60 text-sm mt-1">
                History of ratings and feedback you've left for others.
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 sm:p-6">
          <MyReviewsList />
        </div>
        
      </div>
    </div>
  );
}

export default MyGivenReviews;