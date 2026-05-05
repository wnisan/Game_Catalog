import './LoadingSpinner.css';

const LoadingSpinner = () => {
    return (
        <div className="loading-spinner">
            <div className="loading-spinner__animation"></div>
            <p>Загрузка игр...</p>
        </div>
    );
};

export default LoadingSpinner;