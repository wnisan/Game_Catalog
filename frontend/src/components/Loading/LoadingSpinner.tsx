import './LoadingSpinner.css';

const LoadingSpinner = () => {
    return (
        <div className="loading-spinner">
            <div className="loading-spinner__animation"></div>
            <p>Loading games...</p>
        </div>
    );
};

export default LoadingSpinner;