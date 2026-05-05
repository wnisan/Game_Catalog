import './LoadingMore.css';

interface LoadingMoreProps {
    isLoading: boolean;
    hasMore: boolean;
}

const LoadingMore: React.FC<LoadingMoreProps> = ({ isLoading, hasMore }) => {
    if (!hasMore) {
        return (
            <div className='loading-more__end'>
                <p>Конец списка игр</p>
            </div>
        );
    }

    return (
        <div className="loading-more">
            {isLoading ? (
                <div className="loading-more__spinner"></div>
            ) : (
                <p className="loading-more__text">Прокрутите вниз, чтобы загрузить ещё игры...</p>
            )}
        </div>
    );
};
export default LoadingMore;