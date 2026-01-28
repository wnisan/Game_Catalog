import './LoadingMore.css';

interface LoadingMoreProps {
    isLoading: boolean;
    hasMore: boolean;
}

const LoadingMore: React.FC<LoadingMoreProps> = ({ isLoading, hasMore }) => {
    if (!hasMore) {
        return (
            <div className='loading-more__end'>
                <p>End of games</p>
            </div>
        );
    }

    return (
        <div className="loading-more">
            {isLoading ? (
                <div className="loading-more__spinner"></div>
            ) : (
                <p className="loading-more__text">Scroll down to load more games...</p>
            )}
        </div>
    );
};
export default LoadingMore;