import Sidebar from './SideBar';
import Header from './Header';
import styles from './Admin.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

function AdminLayout({ children }) {
  return (
    <div className={cx('AdminWrapper')}>
      <Sidebar />
      <div className={`${cx('grid__column-10')} ${cx('AdminContent')}`}>
        <Header />
        <div className={cx('page-content')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
